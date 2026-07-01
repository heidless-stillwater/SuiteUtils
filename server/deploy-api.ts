import './services/config-env.js';
import express from 'express';

import { suiteDb as firestore, adminApp as firebaseApp, personaDb, inferenceDb } from './services/FirebaseAdmin.js';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { MigrationManager } from './services/MigrationManager.js';

console.log('🚀 [Cloud Run] Server process starting...');
console.log(`📅 [Cloud Run] Time: ${new Date().toISOString()}`);
console.log(`🔌 [Cloud Run] Expected Port: ${process.env.API_PORT || 5185}`);
console.log(`🔑 [Auth] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const saPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log(`📂 [Auth] SA File exists: ${fs.existsSync(saPath)} (${saPath})`);
}
import cors from 'cors';
import multer from 'multer';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { GoogleAuth } from 'google-auth-library';
import { fileURLToPath } from 'url';
import { GCSStorageProvider } from './services/GCSStorageProvider.js';
import { GoogleDriveStorageProvider } from './services/GoogleDriveStorageProvider.js';
import { IStorageProvider } from './services/IStorageProvider.js';
import { BackupOrchestrator } from './services/BackupOrchestrator.js';
import { ReleaseManager } from './services/ReleaseManager.js';
import { RollbackManager } from './services/RollbackManager.js';
import { MigrationService } from './services/MigrationService.js';
import { healthScanner } from './services/HealthScanner.js';
import { auditLogger } from './services/AuditLogger.js';
import { scheduleManager } from './services/ScheduleManager.js';
import { TokenMarketIndexer } from './services/TokenMarketIndexer.js';
import { operationMonitor } from './services/OperationMonitor.js';
import { notificationManager } from './services/NotificationManager.js';
import emailLogRouter from './routes/emailLog.js';
import supportRouter from './routes/support.js';
import broadcastRouter from './routes/broadcast.js';
import { settingsManager } from './services/SettingsManager.js';
import { suiteConfigManager } from './services/SuiteConfigManager.js';
import { workspaceManager } from './services/WorkspaceManager.js';
import { validationScanner } from './services/ValidationScanner.js';
import { invitationManager } from './services/InvitationManager.js';
import { deploymentManager } from './services/DeploymentManager.js';

console.log('🔥 [Firebase Admin] Initialized with Project:', firebaseApp.options.projectId);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Multi-tenant Workspace Middleware
app.use((req, res, next) => {
  const wsId = req.headers['x-workspace-id'] as string || 'stillwater-suite';
  (req as any).workspaceId = wsId;
  next();
});
const PORT = Number(process.env.API_PORT || process.env.PORT) || 5185;

// Initialize Services
scheduleManager.init();

app.use(cors({ 
  origin: (origin, callback) => {
    // If no origin (e.g. server-to-server or postman/curl), allow it
    if (!origin) return callback(null, true);
    // Allow any origin dynamically to support credentials: true
    callback(null, true);
  }, 
  allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id'],
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use(express.json());

app.get('/api/verify-code', (req, res) => {
  res.json({
    status: 'ok',
    code: 'v7-PathDiagnostics',
    filename: fileURLToPath(import.meta.url),
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
    jobs: deploymentManager.getActiveJobs().length
  });
});

// SUITE ORCHESTRATION
app.post('/api/suite/start-all', async (req, res) => {
  try {
    const wsId = (req as any).workspaceId;
    const workspace = workspaceManager.getWorkspace(wsId);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    console.log(`🔥 [Ignition] Triggering Bulk Ignition for Workspace: ${wsId}`);
    
    // We filter out suiteutils itself (since it's already running) and 
    // trigger parallel startup for the rest
    // Respect suite.config.json enabled flags for cold-start ignition.
    // This allows the user to configure exactly which apps are brought online during ignition.
    const appsToStart = workspace.apps
      .filter(app => {
        if (app.id === 'suiteutils') return false;
        const scriptPrefix = deploymentManager.APP_SCRIPT_MAP[app.id] || app.id;
        return suiteConfigManager.isModuleEnabled(scriptPrefix);
      })
      .map(app => app.id);
    
    if (appsToStart.length > 0) {
      await deploymentManager.bulkToggleLocalApps(appsToStart, true);
      console.log(`🚀 [Ignition] Bulk start signal sent for: ${appsToStart.join(', ')}`);
    }

    const allModules = workspace.apps.map(app => app.id);

    res.json({ 
      success: true, 
      message: `Ignition sequence initiated for ${allModules.length} modules.`,
      modules: allModules
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PERSONA ARCHETYPE MANAGEMENT
app.get('/api/persona/archetypes', async (req, res) => {
  try {
    const snapshot = await personaDb.collection('config').get();
    const archetypes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(archetypes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/persona/archetypes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    
    // 1. Update Persistent Storage (Firestore)
    await personaDb.collection('config').doc(id).set({
      ...update,
      lastSyncAt: new Date().toISOString()
    }, { merge: true });

    // 2. Broadcast Live Observation to Persona Engine
    // We attempt to notify the persona of the change so it can ingest the new principles immediately
    try {
      await fetch(`http://localhost:5005/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DIRECTIVE_UPDATE',
          archetypeId: id,
          payload: update,
          timestamp: new Date().toISOString()
        })
      });
      console.log(`[Neural Sync] Observation broadcast to Persona for archetype: ${id}`);
    } catch (e) {
      console.warn(`[Neural Sync] Persona Hub unreachable. Live sync skipped for ${id}.`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// VALIDATION BACKLOG MANAGEMENT
app.get('/api/validations', async (req, res) => {
  try {
    const wsId = (req as any).workspaceId;
    
    // Dynamically scan for validation plans in docs/
    const seed = await validationScanner.scanAll(wsId);

    // Fetch existing results from Firestore
    const snapshot = await firestore.collection('validations').where('workspaceId', '==', wsId).get();
    const persisted = snapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {} as any);

    // Merge: Persisted data (status/notes) overrides seed data, but preserve seed metadata (group/feature)
    const merged = seed.map(item => {
      const p = persisted[item.id];
      if (p) {
        if (p.deleted) return null;
        return { 
          ...item, 
          status: p.status || item.status,
          lastUpdated: p.lastUpdated || item.lastUpdated
        };
      }
      return item;
    }).filter(Boolean);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(merged);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/validations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const wsId = (req as any).workspaceId;
    
    // We use the validation ID (e.g. VAL-001) as the document ID for simplicity
    await firestore.collection('validations').doc(id).set({
      id,
      status,
      lastUpdated: new Date().toISOString(),
      workspaceId: wsId
    }, { merge: true });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/validations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.query;
    const wsId = (req as any).workspaceId || 'stillwater-suite';

    if (mode === 'hard') {
      const deletedFromMarkdown = await validationScanner.hardDelete(id, wsId);
      if (!deletedFromMarkdown) {
        return res.status(404).json({ error: 'Validation test not found in markdown files' });
      }
      await firestore.collection('validations').doc(id).delete();
    } else {
      await firestore.collection('validations').doc(id).set({
        id,
        deleted: true,
        lastUpdated: new Date().toISOString(),
        workspaceId: wsId
      }, { merge: true });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files from Vite build (dist)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[Server] Serving static files from: ${distPath}`);
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Expires', '0');
        res.setHeader('Pragma', 'no-cache');
      }
    }
  }));
}

// Global Access Logger
app.use((req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.url} | WS: ${req.headers['x-workspace-id']}\n`;
  fs.appendFileSync(path.join(process.cwd(), 'logs/access.log'), logEntry);
  next();
});
app.use('/api/support', supportRouter);
app.use('/api/email-log', emailLogRouter);
app.use('/api/admin/broadcast', broadcastRouter);

const releaseManager = new ReleaseManager();
const activeReleaseControllers = new Map<string, AbortController>();

// GLOBAL PERSISTENCE LISTENER
const terminalStateLocked = new Set<string>();
const verifyingJobs = new Set<string>();

deploymentManager.on('update', async (job: any) => {
  // PERSIST IN-PROGRESS STATES
  if (job.status === 'building' || job.status === 'deploying' || job.status === 'verifying') {
    const workspaceId = job.workspaceId || 'stillwater-suite';
    const appId = job.appId;
    
    const suiteRef = firestore.collection('suites').doc(workspaceId);
    suiteRef.set({
      [`apps.${appId}.environments.production.status`]: job.status,
      updatedAt: Timestamp.now()
    }, { merge: true }).catch(() => {});
  }

  // Handle server-side verification
  if (job.status === 'verifying') {
    if (verifyingJobs.has(job.id)) return;
    verifyingJobs.add(job.id);

    // If no URL is present, we try one last time to extract it from logs or use a placeholder
    if (!job.url) {
      const logsText = job.logs.join('\n');
      // IMPROVED REGEX: Handle gcloud run deploy output more reliably
      const urlMatch = logsText.match(/Service URL: (https?:\/\/\S+)/i) || 
                       logsText.match(/https?:\/\/[a-z0-9-]+\.[a-z0-9-]+\.run\.app/i) ||
                       logsText.match(/https?:\/\/[a-z0-9-]+\.[a-z0-9-]+\.a\.run\.app/i);
      
      if (urlMatch) {
        job.url = urlMatch[1] || urlMatch[0];
      }
    }

    if (job.url) {
      const success = await verifyDeployment(job.url, (msg) => {
        job.logs.push(msg);
        deploymentManager.emit('update', job);
      });

      verifyingJobs.delete(job.id);

      if (success) {
        deploymentManager.finishJob(job.id);
      } else {
        deploymentManager.failJob(job.id, 'Verification failed: App did not become healthy within timeout.');
      }
    } else {
      // FALLBACK: If it's been in verifying for more than 30s without a URL, 
      // and it's a Cloud Run app, we'll mark it as live but warn about the URL.
      // We increase the timeout to 60s for Cloud Run as gcloud output can be delayed.
      const elapsed = (Date.now() - job.startedAt) / 1000;
      if (elapsed > 300) { // 5 minutes total job time
        job.logs.push('\n── WARNING: Could not verify health (URL not found). Marking as LIVE.');
        verifyingJobs.delete(job.id);
        deploymentManager.finishJob(job.id);
      } else {
        verifyingJobs.delete(job.id); // Allow next update to try again
      }
    }
    return;
  }

  if (job.status === 'live' || job.status === 'failed') {
    if (terminalStateLocked.has(job.id)) return;
    terminalStateLocked.add(job.id);

    // We need to know which workspace this job belongs to.
    const workspaceId = job.workspaceId || 'stillwater-suite'; 
    const appId = job.appId;
    const status = job.status === 'live' ? 'live' : 'failed';

    console.log(`[Global Persistence] Detected ${status} for ${appId}. Updating workspace: ${workspaceId}`);

    const suiteRef = firestore.collection('suites').doc(workspaceId);
    const updatePayload: any = {
      [`apps.${appId}.environments.production.status`]: status,
      updatedAt: Timestamp.now()
    };

    if (status === 'live' && job.url) {
      updatePayload[`apps.${appId}.environments.production.deployUrl`] = job.url;
      updatePayload[`apps.${appId}.environments.production.lastDeployAt`] = Timestamp.now();
    }

    try {
      await suiteRef.update(updatePayload);
      console.log(`[Global Persistence] Successfully updated ${appId} to ${status} in ${workspaceId}`);
    } catch (err: any) {
      // If document doesn't exist, fallback to set (though it should exist)
      if (err.code === 5) { // NOT_FOUND
         await suiteRef.set(updatePayload, { merge: true });
      }
    }

    // Persist history record when finished
    firestore.collection('deployments').add({
      suiteId: workspaceId,
      batchId: job.id,
      appId,
      displayName: appId,
      environment: 'production',
      status,
      startedAt: Timestamp.fromMillis(job.startedAt),
      completedAt: Timestamp.now(),
      duration: job.duration || 0,
      deployMethod: job.deployMethod || 'firebase',
      hostingTarget: job.hostingTarget || null,
      project: job.project || 'stillwater-sovereign-02',
      errorLogs: job.error || null,
      deployUrl: job.url || null,
      logs: job.logs || []
    }).catch(err => console.error('[Persistence] History record failed:', err));
  }
});

/**
 * Polls the deployment URL until it returns 200 OK or times out.
 */
async function verifyDeployment(url: string, onProgress?: (msg: string) => void, timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  onProgress?.(`Starting readiness probe for ${url}...`);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (res.status >= 200 && res.status < 400) {
        onProgress?.(`Readiness probe successful (Status: ${res.status})`);
        return true;
      }
      onProgress?.(`Readiness probe: URL reachable but returned status ${res.status}. Retrying...`);
    } catch (e: any) {
      onProgress?.(`Readiness probe: URL not yet reachable (${e.message}). Retrying...`);
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  return false;
}

// BACKGROUND HEALTH SYNC
setInterval(async () => {
  try {
    const suites = await firestore.collection('suites').get();
    for (const doc of suites.docs) {
      const healthResults = await healthScanner.scanAll(doc.id);
      const updates: any = {};
      healthResults.forEach(res => {
        updates[`apps.${res.appId}.health`] = {
          status: res.status.toLowerCase() === 'up' ? 'healthy' : res.status.toLowerCase() === 'down' ? 'unhealthy' : 'degraded',
          lastChecked: res.lastChecked,
          responseTime: res.responseTime || 0,
          appVersion: res.appVersion || 'unknown'
        };
      });
      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
      }
    }
  } catch (err: any) {
    console.error('[HealthSync] Failed:', err.message);
  }
}, 60000);

app.get('/api/health/ping', async (req, res) => {
  const { url } = req.query;
  if (url) {
    try {
      const response = await fetch(url as string, { method: 'GET', signal: AbortSignal.timeout(5000) });
      return res.json({ status: response.ok ? 'UP' : 'DOWN', code: response.status });
    } catch (err: any) {
      return res.json({ status: 'DOWN', error: err.message });
    }
  }
  res.json({ status: 'UP' });
});

app.get('/api/health', async (req, res) => {
  const results = await healthScanner.scanAll((req as any).workspaceId);
  res.json(results);
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await auditLogger.getLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/audit-logs', async (req, res) => {
  try {
    const { type } = req.query;
    await auditLogger.clearLogs(type as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/audit-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await auditLogger.deleteLog(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tokenmarket/trigger-index', async (req, res) => {
  try {
    const record = await TokenMarketIndexer.runHourlyIndex();
    res.json({ success: true, record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// TOKENMARKET PUBLIC DEVELOPER APIS
const tokenMarketDb = getFirestore(firebaseApp, 'tokenmarket-db-0');

// ── Helper: attach SEO / discoverability headers to public TokenMarket responses ──
function setPublicApiHeaders(res: any) {
  res.setHeader('X-Robots-Tag', 'index, follow');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Link', '<https://fundingcloud.com/api-docs.html>; rel="describedby"');
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Powered-By', 'TokenMarket / fundingcloud.com');
}

// 1. [Sector Index] Latest calculations & weights
app.get('/api/tokenmarket/index/latest', async (req, res) => {
  setPublicApiHeaders(res);
  try {
    const snapshot = await tokenMarketDb.collection('market_index_history')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'No index record found' });
    }
    const record = snapshot.docs[0].data();
    // Inject cmrRatio for backwards compatibility / utility docs
    const cmr = record.openRouterMockCost > 0 ? (record.indexValue / record.openRouterMockCost) : 0;
    res.json({
      ...record,
      cmrRatio: parseFloat(cmr.toFixed(4))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. [Sector Index] Historical calculations over time
app.get('/api/tokenmarket/index/history', async (req, res) => {
  setPublicApiHeaders(res);
  try {
    const { timeframe } = req.query;
    let limitCount = 24;
    if (timeframe === '7d') limitCount = 168;
    else if (timeframe === '30d') limitCount = 720;

    const snapshot = await tokenMarketDb.collection('market_index_history')
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get();

    const records = snapshot.docs.map(doc => {
      const data = doc.data();
      const cmr = data.openRouterMockCost > 0 ? (data.indexValue / data.openRouterMockCost) : 0;
      return {
        timestamp: data.timestamp,
        indexValue: data.indexValue,
        cmrValue: parseFloat(cmr.toFixed(4)),
        totalMarketCap: data.totalMarketCap,
        totalVolume24h: data.totalVolume24h
      };
    });
    res.json(records.reverse()); // Chronological order
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. [Live Market] Live token ticker prices
app.get('/api/tokenmarket/live/prices', async (req, res) => {
  setPublicApiHeaders(res);
  try {
    const snapshot = await tokenMarketDb.collection('tokens').get();
    const tokens = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    // Sort stably by market volume desc matching app logic
    tokens.sort((a: any, b: any) => (b.marketVolume || 0) - (a.marketVolume || 0));
    res.json(tokens);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. [Live Market] Live aggregates summary
app.get('/api/tokenmarket/live/summary', async (req, res) => {
  setPublicApiHeaders(res);
  try {
    const snapshot = await tokenMarketDb.collection('tokens').get();
    const tokens = snapshot.docs.map(doc => doc.data() as any);
    if (tokens.length === 0) {
      return res.json({ totalMarketCap: 0, totalVolume24h: 0, overallTrend: 0, activeTickersCount: 0 });
    }
    let totalMarketCap = 0;
    let totalVolume24h = 0;
    let trendAgg = 0;
    
    tokens.forEach(t => {
      const mockSupply = (t.marketVolume || 0) * 100;
      totalMarketCap += (t.priceUSD || 0) * mockSupply;
      totalVolume24h += (t.marketVolume || 0) * (t.priceUSD || 0);
      trendAgg += (t.change24h || 0);
    });

    res.json({
      totalMarketCap: parseFloat(totalMarketCap.toFixed(2)),
      totalVolume24h: parseFloat(totalVolume24h.toFixed(2)),
      overallTrend: parseFloat((trendAgg / tokens.length).toFixed(4)),
      activeTickersCount: tokens.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/schedules', async (req, res) => {
  const schedules = await scheduleManager.getSchedules();
  res.json(schedules);
});

app.patch('/api/schedules/:id', async (req, res) => {
  try {
    const updated = await scheduleManager.updateSchedule(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/schedules', async (req, res) => {
  const schedule = await scheduleManager.addSchedule(req.body);
  res.json(schedule);
});

app.delete('/api/schedules/:id', async (req, res) => {
  await scheduleManager.deleteSchedule(req.params.id);
  res.json({ success: true });
});

app.get('/api/operations', (req, res) => {
  res.json(operationMonitor.getOperations());
});

app.get('/api/operations/:id/events', (req, res) => {
  const { id } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onUpdate = (op: any) => {
    res.write(`data: ${JSON.stringify({ 
      step: op.status === 'completed' ? 'complete' : op.status === 'failed' ? 'error' : 'info',
      message: op.message,
      progress: op.progress,
      percent: op.progress
    })}\n\n`);
    
    if (op.status === 'completed' || op.status === 'failed') {
      operationMonitor.removeListener(`update:${id}`, onUpdate);
      res.end();
    }
  };

  const current = operationMonitor.getOperations().find(o => o.id === id);
  if (current) {
    onUpdate(current);
  }

  operationMonitor.on(`update:${id}`, onUpdate);

  req.on('close', () => {
    operationMonitor.removeListener(`update:${id}`, onUpdate);
  });
});

app.post('/api/schedules/:id/toggle-pause', async (req, res) => {
  await scheduleManager.togglePause(req.params.id);
  res.json({ success: true });
});

app.delete('/api/operations/:id', (req, res) => {
  operationMonitor.cancelOperation(req.params.id);
  res.json({ success: true });
});

app.post('/api/operations/cancel-bulk', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }
  ids.forEach(id => operationMonitor.cancelOperation(id));
  res.json({ success: true, cancelledCount: ids.length });
});

app.get('/api/notifications', (req, res) => {
  res.json(notificationManager.getConfig());
});

app.post('/api/notifications', async (req, res) => {
  const { slackWebhook, discordWebhook } = req.body;
  await notificationManager.saveConfig(slackWebhook, discordWebhook);
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  res.json(settingsManager.getSettings());
});

app.post('/api/settings', async (req, res) => {
  await settingsManager.update(req.body);
  res.json({ success: true });
});

app.get('/api/suite/config', (req, res) => {
  try {
    const configPath = path.join(process.cwd(), 'suite.config.json');
    const config = fs.readJsonSync(configPath);
    res.json(config.modules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suite/config', async (req, res) => {
  try {
    const { enabledModules } = req.body; // Map of scriptPrefix -> enabled
    if (enabledModules) {
      Object.entries(enabledModules).forEach(([prefix, enabled]) => {
        suiteConfigManager.setModuleEnabled(prefix, enabled as boolean);
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspaces', (req, res) => {
  res.json(workspaceManager.getWorkspaces());
});

app.get('/api/workspaces/current', (req, res) => {
  const ws = workspaceManager.getWorkspace((req as any).workspaceId);
  if (!ws) {
    return res.json({ id: (req as any).workspaceId, apps: [] });
  }

  const enrich = (modules: any[] = []) => {
    return modules.map(mod => {
      let lastUpdatedAt: string | null = null;
      if (mod.projectPath) {
        try {
          const resolvedPath = mod.projectPath.replace(/^~/, os.homedir());
          const stats = fs.statSync(resolvedPath);
          lastUpdatedAt = stats.mtime.toISOString();
        } catch (err) {}
      }
      return { ...mod, lastUpdatedAt };
    });
  };

  res.json({
    ...ws,
    apps: enrich(ws.apps),
    infrastructure: enrich(ws.infrastructure)
  });
});

app.post('/api/workspaces/:id/freeze-sort', async (req, res) => {
  const { id } = req.params;
  const { type, direction, appOrder, infraOrder } = req.body;
  try {
    const ws = workspaceManager.getWorkspace(id);
    if (!ws) throw new Error(`Workspace ${id} not found`);
    const updated = await workspaceManager.updateWorkspace(id, {
      ...ws,
      defaultSort: { type, direction, appOrder, infraOrder }
    });
    res.json({ success: true, workspace: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await workspaceManager.updateWorkspace(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await workspaceManager.deleteWorkspace(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/workspaces/:id/invitations', (req, res) => {
  res.json(invitationManager.getInvitationsForWorkspace(req.params.id));
});

app.post('/api/workspaces/:id/invitations', async (req, res) => {
  const { email, role, invitedBy } = req.body;
  const inv = await invitationManager.createInvitation(email, req.params.id, role, invitedBy);
  res.json(inv);
});

app.delete('/api/workspaces/:id/invitations/:invId', async (req, res) => {
  await invitationManager.revokeInvitation(req.params.invId);
  res.json({ success: true });
});

app.post('/api/invitations/:invId/accept', async (req, res) => {
  try {
    const inv = await invitationManager.acceptInvitation(req.params.invId);
    res.json(inv);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/workspaces/:id/my-role', (req, res) => {
  const { email } = req.query;
  const workspace = workspaceManager.getWorkspace(req.params.id);
  
  // 1. Check if user is the Workspace Owner
  if (workspace && workspace.ownerEmail === email) {
    return res.json({ role: 'admin' });
  }

  // 2. Check Invitations
  const invitations = invitationManager.getInvitationsForWorkspace(req.params.id);
  const inv = invitations.find(i => i.email === email);
  res.json({ role: inv ? inv.role : 'viewer' });
});

app.post('/api/migrate', async (req, res) => {
  const { sourceBackupPath, targetWorkspaceId } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write(': sse-init\n\n');

  const storageProvider = getStorageProvider();
  const migrationManager = new MigrationManager(storageProvider);

  try {
    const result = await migrationManager.executeMigration(sourceBackupPath, targetWorkspaceId, (progress: any) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ 
      ...result, 
      message: 'Migration Complete', 
      type: 'success', 
      percent: 100,
      step: 'complete' 
    })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ message: err.message, type: 'error', step: 'error' })}\n\n`);
  } finally {
    // Graceful delay to ensure final buffer flush
    setTimeout(() => res.end(), 100);
  }
});

app.post('/api/migration/analyze', async (req, res) => {
  const { sourceBackupPath, targetWorkspaceId } = req.body;
  const storageProvider = getStorageProvider();
  const migrationManager = new MigrationManager(storageProvider);

  try {
    const mappings = await migrationManager.analyzeMigration(sourceBackupPath, targetWorkspaceId);
    res.json(mappings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve ~ to home directory
function resolvePath(p: string): string {
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}
function getStorageProvider(): IStorageProvider {
  const settings = settingsManager.getSettings();
  const bucketName = process.env.GCS_BUCKET_NAME || 'stillwater-sovereign-02.firebasestorage.app';
  const credentialsPath = path.join(__dirname, 'config/service-account.json');
  if (settings.activeStorageProvider === 'google-drive') {
    return new GoogleDriveStorageProvider(credentialsPath);
  }
  return new GCSStorageProvider(bucketName, credentialsPath);
}

// ============================================================
// AUTH HELPER — reuses ADC / Firebase CLI credentials
// ============================================================

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Failed to obtain Google access token. Run: gcloud auth application-default login');
  return tokenResponse.token;
}


// ============================================================
// GET /api/releases/:hostingTarget
// Lists the last 10 Firebase Hosting releases for a site
// ============================================================

app.get('/api/releases/:hostingTarget', async (req, res) => {
  const { hostingTarget } = req.params;
  const project = (req.query.project as string) || 'stillwater-sovereign-02';

  try {
    const token = await getAccessToken();
    const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${hostingTarget}/releases?pageSize=10`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({ error: err });
      return;
    }

    const data = await response.json() as { releases?: ReleaseRecord[] };
    const releases: ReleaseRecord[] = (data.releases || []).map((r: ReleaseRecord) => ({
      releaseId: r.name?.split('/').pop() || '',
      name: r.name,
      versionName: r.version?.name,
      createTime: r.releaseTime || r.createTime,
      status: r.type === 'DEPLOY' ? 'FINALIZED' : r.type || 'FINALIZED',
      type: r.type || 'DEPLOY',
      fileCount: r.version?.fileCount,
      versionBytes: r.version?.versionBytes,
      message: r.message,
    }));

    console.log(`[Releases] ${hostingTarget}: ${releases.length} found (project: ${project})`);
    res.json({ releases });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Releases] Error for ${hostingTarget}:`, msg);
    res.status(500).json({ error: msg });
  }
});

// ============================================================
// POST /api/rollback
// Clones a past Firebase Hosting version to make it live (~2s, no rebuild)
// Body: { hostingTarget, versionName, project? }
// ============================================================

app.post('/api/rollback', async (req, res) => {
  const { hostingTarget, versionName, project } = req.body;

  if (!hostingTarget || !versionName) {
    res.status(400).json({ error: 'hostingTarget and versionName are required' });
    return;
  }

  const workspaceId = (req as any).workspaceId || 'stillwater-suite';
  const workspace = workspaceManager.getWorkspace(workspaceId);
  const firebaseProject = firebaseApp.options.projectId || workspace?.gcpProjectId || project || 'stillwater-sovereign-02';
  console.log(`\n[Rollback] ${hostingTarget} → ${versionName} (Workspace: ${workspaceId}, Project: ${firebaseProject})`);

  // SSE setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: Record<string, unknown>) => {
    if (res.writableEnded) return; res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const startTime = Date.now();

  try {
    sendEvent({ stage: 'rolling-back', message: `Preparing rollback for ${hostingTarget}...` });

    const token = await getAccessToken();

    sendEvent({ stage: 'rolling-back', message: `Cloning version to live...` });

    // POST a new release pointing to the old version — instant, no rebuild
    const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${firebaseProject}/sites/${hostingTarget}/releases?versionName=${encodeURIComponent(versionName)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const duration = Math.floor((Date.now() - startTime) / 1000);

    if (!response.ok) {
      const errText = await response.text();
      sendEvent({
        stage: 'failed',
        message: `Rollback failed: ${response.status}`,
        error: errText,
        duration,
      });
      console.error(`[Rollback] FAILED (${duration}s):`, errText);
    } else {
      const releaseData = await response.json() as ReleaseRecord;
      const liveUrl = `https://${hostingTarget}.web.app`;
      sendEvent({
        stage: 'live',
        message: `Rollback complete — ${hostingTarget} is live`,
        url: liveUrl,
        releaseId: releaseData.name?.split('/').pop() || '',
        duration,
      });
      console.log(`[Rollback] ${hostingTarget} LIVE (${duration}s) → ${liveUrl}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    sendEvent({ stage: 'failed', message: `Rollback error: ${msg}`, duration });
    console.error(`[Rollback] Error:`, msg);
  }

  res.end();
});

// Shared type for Firebase Hosting API responses
interface ReleaseRecord {
  name?: string;
  type?: string;
  releaseTime?: string;
  createTime?: string;
  message?: string;
  version?: {
    name?: string;
    fileCount?: number;
    versionBytes?: string;
  };
  versionName?: string;
  releaseId?: string;
  createtime?: string;
  status?: string;
  fileCount?: number;
  versionBytes?: string;
}

// Get all active or recently completed deployment jobs
app.get('/api/deploy/active', (req, res) => {
  res.json(deploymentManager.getActiveJobs());
});

// Cancel a deployment job
app.post('/api/deploy/cancel', (req, res) => {
  const { appId } = req.body;
  const activeJobs = deploymentManager.getActiveJobs();
  const job = activeJobs.find(j => 
    j.appId === appId && (j.status === 'building' || j.status === 'deploying' || j.status === 'verifying')
  );

  if (job && deploymentManager.stopDeploy(job.id)) {
    res.json({ success: true, message: 'Deployment cancelled' });
  } else {
    res.status(404).json({ error: 'No active deployment found for this app' });
  }
});

// Force Reset Deployment State
app.post('/api/deploy/reset', async (req, res) => {
  const workspaceId = req.headers['x-workspace-id'] as string;
  
  try {
    deploymentManager.clearAllJobs();
    
    // Also try to update Firestore if we have a suite ID
    if (workspaceId && workspaceId !== 'stillwater-suite' && workspaceId !== 'new-gcp-server') {
      const suiteRef = firestore.collection('suites').doc(workspaceId);
      const suiteDoc = await suiteRef.get();
      if (suiteDoc.exists) {
        const updates: any = {};
        const data = suiteDoc.data() || {};
        Object.keys(data).forEach(key => {
          if (key.endsWith('.status') && (data[key] === 'building' || data[key] === 'deploying' || data[key] === 'verifying')) {
            updates[key] = 'stopped';
          }
        });
        if (Object.keys(updates).length > 0) {
          await suiteRef.update(updates);
        }
      }
    }
    
    res.json({ success: true, message: 'All deployment states reset to idle.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Deploy endpoint — streams output via SSE
app.post('/api/deploy', async (req, res) => {
  const { appId, projectPath, hostingTarget, project, displayName } = req.body;
  const workspaceId = req.headers['x-workspace-id'] as string || 'stillwater-suite';
  let workspace = workspaceManager.getWorkspace(workspaceId) as any;
  let firebaseProject = project || 'stillwater-sovereign-02';
  let resolvedDeployMethod = req.body.deployMethod || 'firebase';
  let resolvedHostingTarget = hostingTarget || null;
  

  // 1. Resolve Workspace (Try local first, then Firestore)
  if (!workspace && workspaceId) {
    try {
      const suiteDoc = await firestore.collection('suites').doc(workspaceId).get();
      if (suiteDoc.exists) {
        const suiteData = suiteDoc.data() || {};
        const rawData = JSON.stringify(suiteData);
        
        // Handle both nested and flattened 'apps'
        const appsMap = new Map<string, any>();
        
        // 1. First pass: Handle nested 'apps' object if it exists
        if (suiteData.apps && typeof suiteData.apps === 'object') {
          Object.entries(suiteData.apps).forEach(([id, data]) => appsMap.set(id, { id, ...(data as object) }));
        }

        // 2. Second pass: Handle flattened keys (e.g., 'apps.plantune.environments.production.deployMethod')
        Object.entries(suiteData).forEach(([key, value]) => {
          if (key.startsWith('apps.')) {
            const parts = key.split('.');
            const appId = parts[1];
            if (!appsMap.has(appId)) appsMap.set(appId, { id: appId });
            
            const app = appsMap.get(appId);
            let current = app;
            
            // Reconstruct nesting for parts after apps.[appId]
            for (let i = 2; i < parts.length - 1; i++) {
              const part = parts[i];
              if (!current[part]) current[part] = {};
              current = current[part];
            }
            
            const lastPart = parts[parts.length - 1];
            if (parts.length > 2) {
              current[lastPart] = value;
            } else {
              // It was just 'apps.appId' = value
              Object.assign(app, value);
            }
          }
        });

        workspace = {
          id: suiteDoc.id,
          name: suiteData.name,
          gcpProjectId: suiteData.gcpProjectId || suiteData['gcpProjectId'],
          apps: Array.from(appsMap.values())
        };
      } else {
      }
    } catch (err: any) {
    }
  }

  // 2. Resolve App Metadata from Workspace
  const workspaceApp = workspace?.apps?.find((a: any) => a.id === appId);
  
  // Use the deployMethod from Firestore if available
  if (workspaceApp) {
    // In Firestore, deployMethod might be nested in environments.production
    const envData = workspaceApp.environments?.production || workspaceApp.defaultEnv;
    resolvedDeployMethod = req.body.deployMethod || envData?.deployMethod || workspaceApp.deployMethod || 'firebase';
    resolvedHostingTarget = hostingTarget || envData?.hostingTarget || workspaceApp.hostingTarget || null;
  }

  firebaseProject = firebaseApp.options.projectId || workspace?.gcpProjectId || project || 'stillwater-sovereign-02';

  // 3. GLOBAL FAIL-SAFE: If this is PlanTune and we still resolved to apps-0, 
  // try to find the 'Target: New GCP Server' workspace globally (Local or Firestore)
  if (appId === 'plantune' && firebaseProject === 'stillwater-sovereign-02') {
    
    // Check local workspaces first
    const localFallback = workspaceManager.getWorkspaces().find(w => w.gcpProjectId === 'stillwater-sovereign-02');
    if (localFallback) {
      workspace = localFallback;
      firebaseProject = 'stillwater-sovereign-02';
      const localApp = workspace.apps.find((a: any) => a.id === 'plantune');
      if (localApp) {
        resolvedDeployMethod = localApp.deployMethod || 'cloud-build';
        resolvedHostingTarget = localApp.hostingTarget || null;
      }
    } else {
      // Check Firestore
      const globalSuites = await firestore.collection('suites').where('gcpProjectId', '==', 'stillwater-sovereign-02').get();
      if (!globalSuites.empty) {
        const suiteDoc = globalSuites.docs[0];
        const suiteData = suiteDoc.data();
        
        firebaseProject = 'stillwater-sovereign-02';
        resolvedDeployMethod = 'cloud-build';
        resolvedHostingTarget = null;
        
        // Also check if this suite has specific overrides for plantune
        const fallbackAppsMap = new Map<string, any>();
        Object.entries(suiteData).forEach(([key, value]) => {
          if (key.startsWith('apps.plantune')) {
            const parts = key.split('.');
            if (!fallbackAppsMap.has('plantune')) fallbackAppsMap.set('plantune', { id: 'plantune' });
            const app = fallbackAppsMap.get('plantune');
            let target = app;
            for (let i = 2; i < parts.length - 1; i++) {
              if (!target[parts[i]]) target[parts[i]] = {};
              target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = value;
          }
        });
        
        const fallbackApp = fallbackAppsMap.get('plantune');
        if (fallbackApp) {
          const envData = fallbackApp.environments?.production || fallbackApp.defaultEnv;
          resolvedDeployMethod = envData?.deployMethod || fallbackApp.deployMethod || 'cloud-build';
          resolvedHostingTarget = envData?.hostingTarget || fallbackApp.hostingTarget || null;
        }
      }
    }
  }

  const jobId = `${appId}-${Date.now()}`;

  if (!appId || !projectPath) {
    res.status(400).json({ error: 'appId and projectPath are required' });
    return;
  }

  const resolvedPath = resolvePath(projectPath);

  console.log(`[Deploy API] Request for: ${appId}`);
  console.log(`[Deploy API] Workspace ID: ${workspaceId}`);
  console.log(`[Deploy API] Resolved Project: ${firebaseProject}`);
  const debugLog = `[${new Date().toISOString()}] Deploy: ${appId} | Workspace: ${workspaceId} | Project: ${firebaseProject} | Method: ${resolvedDeployMethod} | Target: ${resolvedHostingTarget}\n`;

  console.log(`\n[Deploy] Starting: ${appId} (Job: ${jobId}) in Workspace: ${workspaceId} (Target Project: ${firebaseProject})`);
  
  // Set up SSE for the current request
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: any) => {
    if (res.writableEnded) return; res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Attach to manager updates
  const onUpdate = (job: any) => {
    if (job.id !== jobId) return;
    
    // Use try-catch to handle closed connections
    try {
      sendEvent({
        stage: job.status,
        message: job.status === 'live' ? 'Deployment Successful' : job.status === 'failed' ? job.error : undefined,
        output: job.logs[job.logs.length - 1], // Send the latest log line
        duration: job.duration,
        startedAt: job.startedAt,
        url: job.url,
        error: job.error
      });
    } catch (err) {
      deploymentManager.removeListener('update', onUpdate);
    }

    if (job.status === 'live' || job.status === 'failed') {
      deploymentManager.removeListener('update', onUpdate);
      res.end();
    }
  };

  deploymentManager.on('update', onUpdate);

  // Handle client disconnect — DO NOT kill the process, just stop streaming to this response
  res.on('close', () => {
    deploymentManager.removeListener('update', onUpdate);
  });

  console.log(`\n[DEPLOY_API] >>>>> EXECUTING START_DEPLOY FOR: ${appId} (Job: ${jobId}) <<<<<\n`);
  deploymentManager.startDeploy(jobId, appId, resolvedPath, resolvedHostingTarget, firebaseProject, workspaceId, resolvedDeployMethod);
});

// SSE endpoint to re-attach to an existing job
app.get('/api/deploy/:jobId/stream', (req, res) => {
  const { jobId } = req.params;
  const job = deploymentManager.getActiveJobs().find(j => j.id === jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found or already expired' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (data: any) => {
    if (res.writableEnded) return; res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // First, send the existing logs to catch the UI up
  job.logs.forEach(log => {
    sendEvent({ stage: job.status, output: log });
  });

  const onUpdate = (updatedJob: any) => {
    if (updatedJob.id !== jobId) return;
    sendEvent({
      stage: updatedJob.status,
      output: updatedJob.logs[updatedJob.logs.length - 1],
      duration: updatedJob.duration,
      url: updatedJob.url,
      error: updatedJob.error
    });
    if (updatedJob.status === 'live' || updatedJob.status === 'failed') {
      deploymentManager.removeListener('update', onUpdate);
      res.end();
    }
  };

  deploymentManager.on('update', onUpdate);
  res.on('close', () => deploymentManager.removeListener('update', onUpdate));
});


// ============================================================
// Local Suite Orchestration (Non-Tmux)
// ============================================================

app.post('/api/suite/bulk-toggle', async (req, res) => {
  const { appIds, enabled } = req.body;
  if (!Array.isArray(appIds)) {
    return res.status(400).json({ error: 'appIds must be an array' });
  }

  try {
    await deploymentManager.bulkToggleLocalApps(appIds, enabled);
    res.json({ success: true, message: `Bulk ${enabled ? 'enable' : 'disable'} sequence initiated.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suite/start/:appId', async (req, res) => {
  const { appId } = req.params;
  const workspaceId = (req as any).workspaceId || 'stillwater-suite';
  try {
    await deploymentManager.startLocalApp(appId, workspaceId);
    res.json({ success: true, message: `${appId} start sequence initiated.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suite/stop/:appId', async (req, res) => {
  const { appId } = req.params;
  try {
    await deploymentManager.stopLocalApp(appId);
    res.json({ success: true, message: `${appId} stop sequence initiated.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suite/restart/:appId', async (req, res) => {
  const { appId } = req.params;
  try {
    await deploymentManager.restartLocalApp(appId);
    res.json({ success: true, message: `${appId} restart sequence initiated.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/suite/logs/:appId', (req, res) => {
  const { appId } = req.params;
  try {
    const logs = deploymentManager.getLocalLogs(appId);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// GET /api/backups/run
// SSE-based global suite backup orchestrator
// ============================================================

let activeBackupController: AbortController | null = null;

app.post('/api/backups/run', async (req, res) => {
  const { 
    scope = 'StillwaterSuite', 
    name,
    version = '0.0.0', 
    type = 'full', 
    includeStorage = true, 
    appIds, 
    force = false, 
    queue = false 
  } = req.body;
  
  const orchestrator = new BackupOrchestrator(getStorageProvider());
  const backupId = orchestrator.generateBackupId();
  const metadata = { scope, name, appIds, version, includeStorage, type };

  if (!force && !queue) {
    const conflict = operationMonitor.findIdenticalOperation('backup', metadata);
    if (conflict) {
      console.log(`[Backup] Conflict! New job (${scope}) blocked by active job ${conflict.id} (${conflict.metadata?.scope})`);
      return res.status(409).json({ 
        error: 'Conflict detected', 
        message: `An identical backup job (${scope}) is already running.`,
        conflictId: conflict.id,
        metadata: conflict.metadata
      });
    }
  }

  const currentController = new AbortController();
  if (!queue) {
    if (activeBackupController && force) {
      console.log('[Backup] Aborting existing backup...');
      activeBackupController.abort();
    }
    activeBackupController = currentController;
  }

  const runBackup = async (ctrl: AbortController) => {
    try {
      await orchestrator.runFullSuiteBackup({
        version,
        scope,
        name,
        type: type as any,
        includeStorage,
        signal: ctrl.signal,
        appIds,
        releaseId: backupId
      }, ctrl);
      
      if (activeBackupController === ctrl) {
        activeBackupController = null;
      }
    } catch (err: any) {
      console.error('[Backup] Error:', err);
      if (activeBackupController === ctrl) {
        activeBackupController = null;
      }
    }
  };

  operationMonitor.registerController(backupId, currentController);

  if (queue) {
    operationMonitor.enqueue(backupId, () => runBackup(currentController), metadata, currentController);
    return res.json({ id: backupId, status: 'queued' });
  } else {
    runBackup(currentController);
    return res.json({ id: backupId, status: 'running' });
  }
});

app.post('/api/backups/cancel', (req, res) => {
  console.log('[Backup] Received cancellation request');
  if (activeBackupController) {
    console.log('[Backup] Aborting active controller...');
    activeBackupController.abort();
    activeBackupController = null;
    res.json({ message: 'Backup cancellation requested' });
  } else {
    console.log('[Backup] No active backup found to cancel');
    res.status(400).json({ message: 'No active backup to cancel' });
  }
});

// ============================================================
// GET /api/backups
// Lists all backups in GCS
// ============================================================

app.get('/api/backups', async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const db = getFirestore(firebaseApp);
    const snap = await db.collection('backups')
      .where('status', '==', status)
      .get();
    
    let backups = snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        name: data.name || data.id // Ensure name exists for UI filtering
      };
    });

    // Sort in memory by timestamp desc
    backups.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

    res.json({ files: backups });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/:id/archive', async (req, res) => {
  try {
    const orchestrator = new BackupOrchestrator(getStorageProvider());
    await orchestrator.archiveBackup(req.params.id);
    res.json({ message: 'Backup archived successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/:id/unarchive', async (req, res) => {
  try {
    const orchestrator = new BackupOrchestrator(getStorageProvider());
    await orchestrator.unarchiveBackup(req.params.id);
    res.json({ message: 'Backup restored to registry successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/consolidate', async (req, res) => {
  try {
    const storageProvider = getStorageProvider();
    const migrationService = new MigrationService(storageProvider, firebaseApp);
    const result = await migrationService.consolidateStorage();
    res.json({ message: 'Consolidation complete', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/migrate', async (req, res) => {
  try {
    const storageProvider = getStorageProvider();
    const migrationService = new MigrationService(storageProvider, firebaseApp);
    const count = await migrationService.migrateLegacyBackups();
    res.json({ message: `Migration complete. Migrated ${count} backups.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/backups', async (req, res) => {
  const { path: cloudPath } = req.query;
  if (!cloudPath) return res.status(400).json({ error: 'path is required' });

  try {
    const storageProvider = getStorageProvider();
    await storageProvider.delete(cloudPath as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Storage Explorer API
// ============================================================

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/storage/quota', async (req, res) => {
  try {
    const provider = getStorageProvider();
    const quota = await provider.getQuota();
    res.json(quota);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/list', async (req, res) => {
  try {
    const { path: directory = '' } = req.query;
    const storageProvider = getStorageProvider();
    
    let items = await storageProvider.list(directory as string);

    const cleanDir = (directory as string).startsWith('/') ? (directory as string).slice(1) : (directory as string);
    if (cleanDir === 'AppSuite/backups' || cleanDir === 'AppSuite/backups/' || cleanDir === '') {
      try {
        const db = getFirestore(firebaseApp);
        const snapshot = await db.collection('backups').get();
        const registryMap = new Map();
        snapshot.forEach(doc => {
          registryMap.set(doc.id, doc.data());
        });

        items = items.map((item: any) => {
          if (item.isDir) {
            const folderName = item.fullPath.split('/').filter(Boolean).pop();
            if (folderName && registryMap.has(folderName)) {
              const reg = registryMap.get(folderName);
              return {
                ...item,
                routineName: reg.name || reg.scope || folderName,
                lastUpdate: reg.dateStr || reg.timestamp || item.modifiedTime
              };
            }
          }
          return item;
        });
      } catch (dbErr) {
        console.error('[StorageList] Failed to enrich items with Firestore registry:', dbErr);
      }
    }

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/storage/upload', upload.single('file'), async (req, res) => {
  try {
    const { destination } = req.body;
    if (!req.file) throw new Error('No file uploaded');
    
    const storageProvider = getStorageProvider();
    
    const fullPath = path.join(destination || '', req.file.originalname);
    await storageProvider.upload(req.file.buffer, fullPath, req.file.mimetype);
    
    res.json({ success: true, path: fullPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/storage/delete', async (req, res) => {
  try {
    const { path: cloudPath } = req.query;
    const storageProvider = getStorageProvider();
    
    await storageProvider.delete(cloudPath as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/zip-contents', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  try {
    const storageProvider = getStorageProvider();
    
    if (!(storageProvider instanceof GCSStorageProvider)) {
      return res.status(400).json({ error: 'Zip inspection is only supported on GCS for now.' });
    }
    const bucketName = process.env.GCS_BUCKET_NAME || 'stillwater-sovereign-02.firebasestorage.app';
    const bucket = (storageProvider as any).storage.bucket(bucketName);
    const file = bucket.file(filePath as string);
    
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: 'File not found' });

    const unzipper = await import('unzipper');
    const [buffer] = await file.download();
    const zip = await unzipper.Open.buffer(buffer);
    
    const files = zip.files.map(f => ({
      path: f.path,
      size: f.uncompressedSize,
      isDir: f.type === 'Directory'
    }));

    res.json({ files });
  } catch (err: any) {
    console.error('[ZipInspect] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/zip-file-content', async (req, res) => {
  const { zipPath, filePath } = req.query;
  if (!zipPath || !filePath) return res.status(400).json({ error: 'zipPath and filePath are required' });

  try {
    const storageProvider = getStorageProvider();
    
    if (!(storageProvider instanceof GCSStorageProvider)) {
      return res.status(400).json({ error: 'Zip file extraction is only supported on GCS for now.' });
    }
    const bucketName = process.env.GCS_BUCKET_NAME || 'stillwater-sovereign-02.firebasestorage.app';
    const bucket = (storageProvider as any).storage.bucket(bucketName);
    const zipFile = bucket.file(zipPath as string);
    
    const unzipper = await import('unzipper');
    const [buffer] = await zipFile.download();
    const zip = await unzipper.Open.buffer(buffer);
    
    const targetFile = zip.files.find(f => f.path === filePath);
    if (!targetFile) return res.status(404).json({ error: 'File not found in zip' });

    const contentBuffer = await targetFile.buffer();
    const contentString = contentBuffer.toString();

    // Try to parse as JSON if it looks like JSON
    let content = contentString;
    if ((filePath as string).toLowerCase().endsWith('.json')) {
      try {
        content = JSON.parse(contentString);
      } catch (e) {
        // Fallback to string if parsing fails
      }
    }

    res.json({ content });
  } catch (err: any) {
    console.error('[ZipFileInspect] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/storage/delete-bulk', async (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths)) throw new Error('paths must be an array');
    
    const storageProvider = getStorageProvider();
    await storageProvider.deleteBulk(paths);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/storage/mkdir', async (req, res) => {
  try {
    const { name, parentPath = '' } = req.body;
    const storageProvider = getStorageProvider();
    
    const folderPath = await storageProvider.createFolder(name, parentPath);
    res.json({ success: true, path: folderPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/download', async (req, res) => {
  try {
    const { path: cloudPath } = req.query;
    const storageProvider = getStorageProvider();
    
    const url = await storageProvider.getDownloadUrl(cloudPath as string);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/delete-bulk', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });

  try {
    const storageProvider = getStorageProvider();
    const db = getFirestore(firebaseApp);
    
    console.log(`[BackupDelete] Starting bulk delete for ${ids.length} items:`, ids);

    for (const id of ids) {
      const doc = await db.collection('backups').doc(id).get();
      if (doc.exists) {
        const cloudPath = doc.data()?.fullPath;
        console.log(`[BackupDelete] Found registry record for ${id}. CloudPath: ${cloudPath}`);
        
        if (cloudPath) {
          console.log(`[BackupDelete] Deleting files at: ${cloudPath}`);
          await storageProvider.delete(cloudPath);
        } else {
          console.warn(`[BackupDelete] No cloudPath found for ${id}, skipping storage deletion.`);
        }
        
        console.log(`[BackupDelete] Deleting Firestore record for ${id}`);
        await db.collection('backups').doc(id).delete();
      } else {
        console.warn(`[BackupDelete] No registry record found for ${id}, skipping.`);
      }
    }
    
    console.log(`[BackupDelete] Bulk delete complete.`);
    res.json({ success: true, deletedCount: ids.length });
  } catch (err: any) {
    console.error(`[BackupDelete] FATAL ERROR:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/releases/run
// Isolated build & deploy using git worktrees
// ============================================================
app.get('/api/releases/run', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: any) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const { appId, ref, env } = req.query as any;
  if (!appId || !ref || !env) {
    sendEvent({ type: 'error', message: 'appId, ref, and env are required.' });
    res.end();
    return;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // Increased to 10s for Cloud Run cold starts
  activeReleaseControllers.set(appId, controller);

  try {
    await releaseManager.enqueueRelease({
      appId,
      ref,
      env,
      signal: controller.signal,
      onProgress: (p) => sendEvent(p)
    });
  } catch (err: any) {
    sendEvent({ type: 'error', message: err.message });
  } finally {
    activeReleaseControllers.delete(appId);
    res.end();
  }
});

app.post('/api/releases/cancel', (req, res) => {
  const { appId } = req.body;
  console.log(`[Release] Cancellation requested for appId: ${appId}`);
  const controller = activeReleaseControllers.get(appId);
  if (controller) {
    console.log(`[Release] Found controller for ${appId}, aborting...`);
    controller.abort();
    res.json({ message: 'Release cancellation requested' });
  } else {
    console.log(`[Release] No active controller found for ${appId}. Active apps:`, Array.from(activeReleaseControllers.keys()));
    res.status(400).json({ message: 'No active release found for this app' });
  }
});

// ============================================================
// GET /api/backups/restore
// Global suite rollback to a past snapshot
// ============================================================
app.get('/api/backups/restore', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: any) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const { cloudPath, appIds, includeStorage, confirmation } = req.query as any;
  
  if (!cloudPath || !appIds || !confirmation) {
    sendEvent({ type: 'error', message: 'cloudPath, appIds, and confirmation are required.' });
    res.end();
    return;
  }

  // SaaS-style safety check: Confirmation must match appId (or just be present for global)
  // For now, we'll assume confirmation is the appId or a secret string if global.
  
  const storageProvider = getStorageProvider();
  const rollbackManager = new RollbackManager(storageProvider);

  try {
    await rollbackManager.performRollback({
      cloudPath,
      appIds: appIds.split(','),
      includeStorage: includeStorage === 'true',
      onProgress: (p) => sendEvent(p)
    });
  } catch (err: any) {
    sendEvent({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// ============================================================
// GCP Inference VM Deploy & Control
// ============================================================
interface InferenceJob {
  status: 'idle' | 'running' | 'success' | 'failed';
  action: 'START' | 'STOP';
  gpuType: 'l4' | 't4' | 'none';
  logs: string[];
  startTime: number;
  elapsed: number;
}

let activeInferenceJob: InferenceJob = {
  status: 'idle',
  action: 'START',
  gpuType: 'none',
  logs: [],
  startTime: 0,
  elapsed: 0
};

app.post('/api/inference/deploy', async (req, res) => {
  const { action, gpu } = req.body;
  if (!action || (action !== 'START' && action !== 'STOP')) {
    return res.status(400).json({ error: "Invalid action. Use 'START' or 'STOP'." });
  }

  if (activeInferenceJob.status === 'running') {
    return res.status(400).json({ error: "An inference VM deployment or shutdown is already in progress." });
  }

  const gpuType = (gpu || 'none').toLowerCase() as 'l4' | 't4' | 'none';
  
  // Reset job status
  activeInferenceJob = {
    status: 'running',
    action,
    gpuType,
    logs: [
      `[${new Date().toISOString()}] Initiating VM ${action} sequence...`
    ],
    startTime: Date.now(),
    elapsed: 0
  };

  const scriptPath = action === 'START' ? './scripts/gcp-deploy-ollama.sh' : './scripts/gcp-vm-control.sh';
  const args = action === 'START' ? ['--gpu', gpuType] : ['stop'];
  const cwd = '/home/heidless/projects/InferenceGateway';

  console.log(`[Inference Deploy] Spawning: ${scriptPath} ${args.join(' ')} in ${cwd}`);
  activeInferenceJob.logs.push(`$ cd ${cwd} && ${scriptPath} ${args.join(' ')}`);

  try {
    const child = spawn(scriptPath, args, {
      cwd,
      env: { ...process.env, PATH: process.env.PATH }
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    const handleData = (data: Buffer, isError: boolean) => {
      const text = data.toString('utf8');
      if (isError) {
        stderrBuffer += text;
      } else {
        stdoutBuffer += text;
      }

      const activeBuffer = isError ? stderrBuffer : stdoutBuffer;
      const lines = activeBuffer.split('\n');
      if (isError) {
        stderrBuffer = lines.pop() || '';
      } else {
        stdoutBuffer = lines.pop() || '';
      }

      for (const line of lines) {
        // Strip ANSI escape codes
        const cleanLine = line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
        if (cleanLine) {
          activeInferenceJob.logs.push(cleanLine);
        }
      }
    };

    child.stdout.on('data', (data) => handleData(data, false));
    child.stderr.on('data', (data) => handleData(data, true));

    child.on('close', async (code) => {
      // Flush remaining buffers
      const finalStdout = stdoutBuffer.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
      const finalStderr = stderrBuffer.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
      if (finalStdout) activeInferenceJob.logs.push(finalStdout);
      if (finalStderr) activeInferenceJob.logs.push(finalStderr);

      activeInferenceJob.elapsed = Math.floor((Date.now() - activeInferenceJob.startTime) / 1000);

      if (code === 0) {
        activeInferenceJob.status = 'success';
        activeInferenceJob.logs.push(`[${new Date().toISOString()}] Sequence completed successfully.`);

        // Find endpoint IP
        let extractedEndpoint = '';
        for (const line of activeInferenceJob.logs) {
          if (line.includes('Remote Ollama Endpoint:')) {
            const match = line.match(/Remote Ollama Endpoint:\s*(http:\/\/[0-9.]+:\d+)/i);
            if (match && match[1]) {
              extractedEndpoint = match[1];
              break;
            }
          }
        }

        // Update Firestore
        try {
          const updateData: any = {
            vmStatus: action === 'START' ? 'RUNNING' : 'STOPPED',
            updatedAt: new Date().toISOString()
          };
          if (action === 'START' && extractedEndpoint) {
            updateData.gcpEndpoint = extractedEndpoint;
          }
          if (action === 'START') {
            const hardwareMap: Record<string, string> = {
              l4: 'NVIDIA L4 (24GB VRAM)',
              t4: 'NVIDIA Tesla T4 (16GB VRAM)',
              none: 'CPU Only (e2-standard-8)'
            };
            updateData.gcpHardware = hardwareMap[gpuType] || 'CPU Only (e2-standard-8)';
          }

          await inferenceDb.collection('admin').doc('inferenceConfig').update(updateData);
          console.log('[Inference Deploy] Firestore updated successfully:', updateData);
        } catch (dbErr: any) {
          console.error('[Inference Deploy] Firestore update failed:', dbErr.message);
          activeInferenceJob.logs.push(`[ERROR] Firestore config update failed: ${dbErr.message}`);
        }
      } else {
        activeInferenceJob.status = 'failed';
        activeInferenceJob.logs.push(`[${new Date().toISOString()}] Sequence failed with exit code ${code}.`);

        // Self-healing: If stopping a VM and it fails because it was not found/doesn't exist,
        // sync the Firestore state to STOPPED anyway so the user is not locked out of starting it.
        if (action === 'STOP') {
          const hasNotFoundError = activeInferenceJob.logs.some(line => 
            line.toLowerCase().includes('not found') || 
            line.toLowerCase().includes('404') || 
            line.toLowerCase().includes('does not exist')
          );
          if (hasNotFoundError) {
            try {
              await inferenceDb.collection('admin').doc('inferenceConfig').update({
                vmStatus: 'STOPPED',
                updatedAt: new Date().toISOString()
              });
              activeInferenceJob.logs.push(`[INFO] VM not found on GCP. Synced state to STOPPED.`);
            } catch (dbErr: any) {
              console.error('[Inference Deploy] Failed to sync stopped state:', dbErr.message);
            }
          }
        }
      }
    });

    res.json({ success: true, message: `Deployment ${action} sequence initiated.` });
  } catch (err: any) {
    console.error('[Inference Deploy] Failed to spawn process:', err);
    activeInferenceJob.status = 'failed';
    activeInferenceJob.logs.push(`[ERROR] Failed to start process: ${err.message}`);
    res.status(500).json({ error: `Failed to initiate process: ${err.message}` });
  }
});

app.get('/api/inference/deploy/status', (req, res) => {
  if (activeInferenceJob.status === 'running') {
    activeInferenceJob.elapsed = Math.floor((Date.now() - activeInferenceJob.startTime) / 1000);
  }
  res.json({
    status: activeInferenceJob.status,
    action: activeInferenceJob.action,
    gpuType: activeInferenceJob.gpuType,
    logs: activeInferenceJob.logs,
    elapsed: activeInferenceJob.elapsed
  });
});

app.post('/api/inference/config', async (req, res) => {
  const updateData = req.body;
  try {
    await inferenceDb.collection('admin').doc('inferenceConfig').update(updateData);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Inference Config] Update failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inference/proxy', async (req, res) => {
  const { url, method, headers, body } = req.body;
  try {
    const response = await fetch(url, {
      method: method || 'POST',
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined
    });
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err: any) {
    console.error('[Inference Proxy] Relay failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function syncCloudModelsInRegistry() {
  try {
    const docRef = inferenceDb.collection('admin').doc('modelRegistry');
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const catalog = data?.catalog || [];
      
      const cloudModelsToAdd = [
        { name: 'gemini-2.5-flash', tags: ['cloud', 'google'], size: 'N/A', description: 'Google high-speed model.' },
        { name: 'gpt-4o', tags: ['cloud', 'openai'], size: 'N/A', description: 'OpenAI flagship omni model.' },
        { name: 'claude-3.5-sonnet', tags: ['cloud', 'anthropic'], size: 'N/A', description: 'Anthropic high-reasoning model.' },
        { name: 'deepseek-v3', tags: ['cloud', 'deepseek'], size: 'N/A', description: 'DeepSeek reasoning model.' }
      ];
      
      let updated = false;
      const newCatalog = [...catalog];
      for (const model of cloudModelsToAdd) {
        if (!catalog.some((m: any) => m.name === model.name)) {
          newCatalog.push(model);
          updated = true;
        }
      }
      
      if (updated) {
        await docRef.update({
          catalog: newCatalog,
          updatedAt: new Date().toISOString()
        });
        console.log('[Inference Sync] Successfully registered cloud models in database.');
      }
    }
  } catch (err: any) {
    console.error('[Inference Sync] Error syncing cloud models in registry:', err.message);
  }
}
syncCloudModelsInRegistry();

let cachedBillingInfo: { tier: string; quotas: Record<string, string> } | null = null;
async function detectGcpBillingInfo() {
  try {
    const output = execSync('gcloud compute regions describe us-central1 --format="json(quotas)"', { encoding: 'utf8' });
    const parsed = JSON.parse(output);
    const quotas = parsed.quotas || [];
    
    const t4LimitObj = quotas.find((q: any) => q.metric === 'NVIDIA_T4_GPUS');
    const l4LimitObj = quotas.find((q: any) => q.metric === 'NVIDIA_L4_GPUS');
    
    const t4Limit = t4LimitObj ? t4LimitObj.limit : 0;
    const l4Limit = l4LimitObj ? l4LimitObj.limit : 0;
    
    const isFree = t4Limit === 0 && l4Limit === 0;
    cachedBillingInfo = {
      tier: isFree ? 'Free Tier' : 'Paid Tier',
      quotas: {
        l4: l4Limit > 0 ? 'AVAILABLE' : 'RESTRICTED',
        t4: t4Limit > 0 ? 'AVAILABLE' : 'RESTRICTED'
      }
    };
    console.log('[Billing Detector] Detected billing info:', cachedBillingInfo);
  } catch (err: any) {
    console.error('[Billing Detector] Failed to detect billing info:', err.message);
    cachedBillingInfo = {
      tier: 'Unknown Tier',
      quotas: {
        l4: 'RESTRICTED',
        t4: 'RESTRICTED'
      }
    };
  }
}
detectGcpBillingInfo();

app.get('/api/inference/billing', async (req, res) => {
  if (!cachedBillingInfo || req.query.refresh === 'true') {
    await detectGcpBillingInfo();
  }
  res.json(cachedBillingInfo);
});

// ============================================================
// Validation Engine Configuration (autoValidate toggle)
// ============================================================
app.get('/api/validation-config', async (req, res) => {
  try {
    const docRef = personaDb.collection('config').doc('persona_architect');
    const docSnap = await docRef.get();
    let autoValidate = true;
    if (docSnap.exists) {
      const data = docSnap.data();
      autoValidate = data?.autoValidate !== false;
    }
    res.json({ autoValidate });
  } catch (err: any) {
    console.error('Failed to get validation config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/validation-config/toggle', async (req, res) => {
  try {
    const docRef = personaDb.collection('config').doc('persona_architect');
    const docSnap = await docRef.get();
    let currentVal = true;
    if (docSnap.exists) {
      const data = docSnap.data();
      currentVal = data?.autoValidate !== false;
    }
    const newVal = !currentVal;
    
    // Update Firestore
    await docRef.set({ autoValidate: newVal, lastSyncAt: new Date().toISOString() }, { merge: true });
    
    // Update local profile.json
    const personaConfigPath = path.join(os.homedir(), '.config', 'persona', 'profile.json');
    if (fs.existsSync(personaConfigPath)) {
      try {
        const profile = JSON.parse(fs.readFileSync(personaConfigPath, 'utf8'));
        profile.autoValidate = newVal;
        profile.lastSyncAt = new Date().toISOString();
        fs.writeFileSync(personaConfigPath, JSON.stringify(profile, null, 2), 'utf8');
        console.log('[deploy-api] Successfully updated local Persona profile.json to', newVal);
      } catch (e: any) {
        console.error('[deploy-api] Failed to update local Persona profile.json:', e.message);
      }
    }
    
    res.json({ autoValidate: newVal });
  } catch (err: any) {
    console.error('Failed to toggle validation config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Ollama Model Pull (SSE proxy to avoid browser CORS)
// ============================================================
app.post('/api/ollama/pull', async (req, res) => {
  const { modelName, endpoint } = req.body as { modelName: string; endpoint: string };

  if (!modelName || !endpoint) {
    return res.status(400).json({ error: 'modelName and endpoint are required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if proxied
  res.flushHeaders();

  const sendEvent = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  const targetUrl = new URL('/api/pull', endpoint);
  const body = JSON.stringify({ name: modelName, stream: true });

  // Use Node's built-in http/https to make the upstream request
  const protocol = targetUrl.protocol === 'https:' ? await import('https') : await import('http');
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 30 * 60 * 1000, // 30 minute timeout for large models
  };

  console.log(`[Ollama Pull] Starting pull of '${modelName}' from ${endpoint}`);
  sendEvent(JSON.stringify({ status: 'starting', model: modelName }));

  const upstream = protocol.request(options, (upstreamRes) => {
    let buffer = '';

    upstreamRes.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      // NDJSON: split on newlines, process each complete line
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            sendEvent(JSON.stringify(parsed));
          } catch {
            // Not valid JSON, send as raw status
            sendEvent(JSON.stringify({ status: trimmed }));
          }
        }
      }
    });

    upstreamRes.on('end', () => {
      // Flush any remaining buffer content
      if (buffer.trim()) {
        try {
          sendEvent(JSON.stringify(JSON.parse(buffer.trim())));
        } catch {
          sendEvent(JSON.stringify({ status: buffer.trim() }));
        }
      }
      console.log(`[Ollama Pull] Completed pull of '${modelName}'`);
      sendEvent('[DONE]');
      res.end();
    });
  });

  upstream.on('error', (err: Error) => {
    console.error(`[Ollama Pull] Error pulling '${modelName}':`, err.message);
    sendEvent(JSON.stringify({ error: err.message }));
    sendEvent('[DONE]');
    res.end();
  });

  upstream.on('timeout', () => {
    console.error(`[Ollama Pull] Timeout pulling '${modelName}'`);
    upstream.destroy();
    sendEvent(JSON.stringify({ error: 'Request timed out' }));
    sendEvent('[DONE]');
    res.end();
  });

  upstream.write(body);
  upstream.end();

  // Clean up if client disconnects early
  req.on('close', () => {
    console.log(`[Ollama Pull] Client disconnected during pull of '${modelName}'`);
    upstream.destroy();
  });
});

// Proxy endpoint for getting Ollama tags
app.get('/api/ollama/tags', async (req, res) => {
  const { endpoint } = req.query as { endpoint: string };
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint query parameter is required' });
  }
  try {
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error(`[Ollama Proxy Tags] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy endpoint for deleting Ollama models
app.post('/api/ollama/delete', async (req, res) => {
  const { name, endpoint } = req.body as { name: string; endpoint: string };
  if (!name || !endpoint) {
    return res.status(400).json({ error: 'name and endpoint are required' });
  }
  try {
    const response = await fetch(`${endpoint}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error(`[Ollama Proxy Delete] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy endpoint for Ollama generate — streams NDJSON response as SSE
app.post('/api/ollama/generate', async (req, res) => {
  const { model, prompt, endpoint, stream = true } = req.body as {
    model: string;
    prompt: string;
    endpoint: string;
    stream?: boolean;
  };

  if (!model || !prompt || !endpoint) {
    return res.status(400).json({ error: 'model, prompt, and endpoint are required' });
  }

  try {
    const upstream = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: true })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({ error: errText || `Upstream returned ${upstream.status}` });
    }

    if (!upstream.body) {
      return res.status(502).json({ error: 'No response body from Ollama' });
    }

    // Stream as SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const reader = (upstream.body as any).getReader ? (upstream.body as any).getReader() : null;
    if (!reader) {
      return res.status(502).json({ error: 'Streaming not supported by upstream' });
    }

    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
            if (parsed.done) break;
          } catch { /* skip non-JSON lines */ }
        }
      }
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err: any) {
    console.error('[Ollama Proxy Generate] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  req.on('close', () => {
    console.log(`[Ollama Generate] Client disconnected`);
  });
});

// SPA fallback: handle client-side routing (must be LAST)
app.get('*any', (req, res) => {
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error Handler]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SuiteUtils Deploy API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
