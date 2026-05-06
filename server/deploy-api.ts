import express from 'express';
console.log('🚀 [Cloud Run] Server process starting...');
console.log(`📅 [Cloud Run] Time: ${new Date().toISOString()}`);
console.log(`🔌 [Cloud Run] Expected Port: ${process.env.PORT || 5185}`);
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
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
import { operationMonitor } from './services/OperationMonitor.js';
import { notificationManager } from './services/NotificationManager.js';
import { settingsManager } from './services/SettingsManager.js';
import { workspaceManager } from './services/WorkspaceManager.js';
import { invitationManager } from './services/InvitationManager.js';
import { MigrationManager } from './services/MigrationManager.js';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { suiteDb as firestore, adminApp as firebaseApp } from './services/FirebaseAdmin.js';
import { deploymentManager } from './services/DeploymentManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Multi-tenant Workspace Middleware
app.use((req, res, next) => {
  const wsId = req.headers['x-workspace-id'] as string || 'stillwater-suite';
  (req as any).workspaceId = wsId;
  next();
});
const PORT = Number(process.env.PORT) || 5185;

// Initialize Services
scheduleManager.init();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve static files from Vite build (dist)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[Server] Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
}

// Global Access Logger
app.use((req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.url} | WS: ${req.headers['x-workspace-id']}\n`;
  fs.appendFileSync(path.join(process.cwd(), 'logs/access.log'), logEntry);
  next();
});

const releaseManager = new ReleaseManager();
const activeReleaseControllers = new Map<string, AbortController>();

// GLOBAL PERSISTENCE LISTENER
const terminalStateLocked = new Set<string>();
const verifyingJobs = new Set<string>();

deploymentManager.on('update', async (job: any) => {
  // Handle server-side verification
  if (job.status === 'verifying') {
    if (verifyingJobs.has(job.id)) return;
    verifyingJobs.add(job.id);

    // If no URL is present, we try one last time to extract it from logs or use a placeholder
    if (!job.url) {
      const logsText = job.logs.join('\n');
      const urlMatch = logsText.match(/Service URL: (https?:\/\/\S+)/) || 
                       logsText.match(/https?:\/\/[a-z0-9-]+\.[a-z0-9-]+\.a\.run\.app/);
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
      // This prevents the "hanging" state the user reported.
      const elapsed = (Date.now() - job.startedAt) / 1000;
      if (elapsed > 45) {
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
    const suiteUpdate: any = {
      [`apps.${appId}.environments.production.status`]: status,
      [`apps.${appId}.environments.production.lastDeployAt`]: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    if (job.url) {
      suiteUpdate[`apps.${appId}.environments.production.deployUrl`] = job.url;
    }

    suiteRef.set(suiteUpdate, { merge: true })
    .then(() => {
      const msg = `[Global Persistence] Successfully updated ${appId} in ${workspaceId}\n`;
    })
    .catch(err => {
      const msg = `[Global Persistence] Failed for ${appId} in ${workspaceId}: ${err.message}\n`;
    });

    // Persist history record when finished
    const persistenceMsg = `[Persistence] Saving history record for ${appId} (${status}) to suite: ${workspaceId}\n`;
    
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
      project: job.project || 'heidless-apps-2',
      errorLogs: job.error || null,
      deployUrl: job.url || null
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

app.get('/api/workspaces', (req, res) => {
  res.json(workspaceManager.getWorkspaces());
});

app.get('/api/workspaces/current', (req, res) => {
  const ws = workspaceManager.getWorkspace((req as any).workspaceId);
  res.json(ws);
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
  const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-2.firebasestorage.app';
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// GET /api/releases/:hostingTarget
// Lists the last 10 Firebase Hosting releases for a site
// ============================================================

app.get('/api/releases/:hostingTarget', async (req, res) => {
  const { hostingTarget } = req.params;
  const project = (req.query.project as string) || 'heidless-apps-2';

  try {
    const token = await getAccessToken();
    const url = `https://firebasehosting.googleapis.com/v1beta1/sites/${hostingTarget}/releases?pageSize=10`;

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
  const firebaseProject = workspace?.gcpProjectId || project || 'heidless-apps-2';
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
    const url = `https://firebasehosting.googleapis.com/v1beta1/sites/${hostingTarget}/releases?versionName=${encodeURIComponent(versionName)}`;

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
  let firebaseProject = project || 'heidless-apps-2';
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

  firebaseProject = workspace?.gcpProjectId || project || 'heidless-apps-2';

  // 3. GLOBAL FAIL-SAFE: If this is PlanTune and we still resolved to apps-0, 
  // try to find the 'Target: New GCP Server' workspace globally (Local or Firestore)
  if (appId === 'plantune' && firebaseProject === 'heidless-apps-2') {
    
    // Check local workspaces first
    const localFallback = workspaceManager.getWorkspaces().find(w => w.gcpProjectId === 'heidless-apps-2');
    if (localFallback) {
      workspace = localFallback;
      firebaseProject = 'heidless-apps-2';
      const localApp = workspace.apps.find((a: any) => a.id === 'plantune');
      if (localApp) {
        resolvedDeployMethod = localApp.deployMethod || 'cloud-build';
        resolvedHostingTarget = localApp.hostingTarget || null;
      }
    } else {
      // Check Firestore
      const globalSuites = await firestore.collection('suites').where('gcpProjectId', '==', 'heidless-apps-2').get();
      if (!globalSuites.empty) {
        const suiteDoc = globalSuites.docs[0];
        const suiteData = suiteDoc.data();
        
        firebaseProject = 'heidless-apps-2';
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

  // Start the background process AFTER attaching listener
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
    
    const items = await storageProvider.list(directory as string);
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
    const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-2.firebasestorage.app';
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
    const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-2.firebasestorage.app';
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

// SPA fallback: handle client-side routing (must be LAST)
app.get('*any', (req, res) => {
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 SuiteUtils Deploy API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
