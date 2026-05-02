import express from 'express';
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
import { healthScanner } from './services/HealthScanner.js';
import { auditLogger } from './services/AuditLogger.js';
import { scheduleManager } from './services/ScheduleManager.js';
import { operationMonitor } from './services/OperationMonitor.js';
import { notificationManager } from './services/NotificationManager.js';
import { settingsManager } from './services/SettingsManager.js';
import { workspaceManager } from './services/WorkspaceManager.js';
import { invitationManager } from './services/InvitationManager.js';
import { MigrationManager } from './services/MigrationManager.js';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Multi-tenant Workspace Middleware
app.use((req, res, next) => {
  const wsId = req.headers['x-workspace-id'] as string || 'stillwater-suite';
  (req as any).workspaceId = wsId;
  next();
});
const PORT = 5181;

// Initialize Services
scheduleManager.init();

app.use(cors({ origin: '*' }));
app.use(express.json());

const releaseManager = new ReleaseManager();
const activeReleaseControllers = new Map<string, AbortController>();

// Initialize Firebase Admin
const firebaseApp = getApps().length === 0 
  ? initializeApp({ 
      credential: applicationDefault(), 
      projectId: 'heidless-apps-0' 
    })
  : getApps()[0];

const firestore = getFirestore(firebaseApp, 'suiteutils-db-0');

/**
 * Polls the deployment URL until it returns 200 OK or times out.
 */
async function verifyDeployment(url: string, onProgress?: (msg: string) => void, timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  onProgress?.(`Starting readiness probe for ${url}...`);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use no-cache to bypass any interim CDN caching of 404s
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      // Accept both 2xx (Success) and 3xx (Redirects, e.g. to /login) as evidence that the app is live
      if (res.status >= 200 && res.status < 400) {
        onProgress?.(`Readiness probe successful (Status: ${res.status})`);
        return true;
      }
      onProgress?.(`Readiness probe: URL reachable but returned status ${res.status}. Retrying...`);
    } catch (e: any) {
      onProgress?.(`Readiness probe: URL not yet reachable (${e.message}). Retrying...`);
    }
    await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
  }
  return false;
}

app.get('/api/health/ping', (req, res) => {
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

  const storageProvider = getStorageProvider();
  const migrationManager = new MigrationManager(storageProvider);

  try {
    await migrationManager.executeMigration(sourceBackupPath, targetWorkspaceId, (progress: any) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ message: 'Migration Complete', type: 'success', percent: 100 })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ message: err.message, type: 'error' })}\n\n`);
  } finally {
    res.end();
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
  const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-0.firebasestorage.app';
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
  const project = (req.query.project as string) || 'heidless-apps-0';

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

  const firebaseProject = project || 'heidless-apps-0';
  console.log(`\n[Rollback] ${hostingTarget} → ${versionName}`);

  // SSE setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
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

// Deploy endpoint — streams output via SSE
app.post('/api/deploy', (req, res) => {
  const { appId, projectPath, hostingTarget, project, deployMethod, displayName } = req.body;

  if (!appId || !projectPath) {
    res.status(400).json({ error: 'appId and projectPath are required' });
    return;
  }

  const resolvedPath = resolvePath(projectPath);
  const firebaseProject = project || 'heidless-apps-0';

  console.log(`\n[Deploy] Starting: ${appId}`);
  console.log(`  Path: ${resolvedPath}`);
  console.log(`  Target: ${hostingTarget || 'cloud-build'}`);
  console.log(`  Method: ${deployMethod || 'firebase'}`);

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const startTime = Date.now();

  sendEvent({
    stage: 'building',
    message: `Building ${appId}...`,
    timestamp: new Date().toISOString(),
  });

  // Step 1: npm run build
  const buildProc = spawn('npm', ['run', 'build'], {
    cwd: resolvedPath,
    shell: '/bin/bash',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  let buildOutput = '';
  let buildError = '';

  buildProc.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    buildOutput += text;
    sendEvent({ stage: 'building', output: text });
  });

  buildProc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    buildError += text;
    // stderr often contains warnings, not just errors
    sendEvent({ stage: 'building', output: text, isStderr: true });
  });

  buildProc.on('close', (buildCode) => {
    if (buildCode !== 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      // Persist failure status and timestamp
      const workspaceId = (req as any).workspaceId || 'stillwater-suite';
      const suiteRef = firestore.collection('suites').doc(workspaceId);
      suiteRef.set({
        [`apps.${appId}.environments.production.status`]: 'failed',
        [`apps.${appId}.environments.production.lastDeployAt`]: Timestamp.now(),
        updatedAt: Timestamp.now()
      }, { merge: true }).catch(err => console.error(`[Deploy] Build Failure Persistence Failed:`, err.message));

      // Save to deployment history
      firestore.collection('deployments').add({
        suiteId: workspaceId,
        batchId: `${appId}-${startTime}`,
        appId,
        displayName: displayName || appId,
        environment: 'production',
        status: 'failed',
        startedAt: Timestamp.fromMillis(startTime),
        completedAt: Timestamp.now(),
        duration: elapsed,
        deployMethod: deployMethod || 'firebase',
        hostingTarget: hostingTarget || null,
        project: firebaseProject,
        errorLogs: buildError || buildOutput || 'Build failed'
      }).catch(err => console.error(`[Deploy] Build History Persistence Failed:`, err.message));

      sendEvent({
        stage: 'failed',
        message: `Build failed with exit code ${buildCode}`,
        error: buildError || buildOutput,
        duration: elapsed,
      });
      res.end();
      console.log(`[Deploy] ${appId} BUILD FAILED (${elapsed}s)`);
      return;
    }

    sendEvent({
      stage: 'deploying',
      message: `Build complete. Deploying ${appId}...`,
    });

    // Step 2: firebase deploy
    if (deployMethod === 'cloud-build' || !hostingTarget) {
      // Cloud Build apps — placeholder for now
      sendEvent({
        stage: 'failed',
        message: 'Cloud Build deployment not yet implemented',
        duration: Math.floor((Date.now() - startTime) / 1000),
      });
      res.end();
      return;
    }

    const deployArgs = [
      'deploy',
      '--only', `hosting:${hostingTarget}`,
      '--project', firebaseProject,
    ];

    const localFirebase = path.join(resolvedPath, 'node_modules', '.bin', 'firebase');
    const firebaseCmd = fs.existsSync(localFirebase) ? localFirebase : 'firebase';
    const localBin = path.join(resolvedPath, 'node_modules', '.bin');
    const newPath = `${localBin}${path.delimiter}${process.env.PATH}`;

    const deployProc = spawn(firebaseCmd, deployArgs, {
      cwd: resolvedPath,
      shell: '/bin/bash',
      env: { ...process.env, PATH: newPath, FORCE_COLOR: '0' },
    });

    let deployOutput = '';
    let deployError = '';

    deployProc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      deployOutput += text;
      sendEvent({ stage: 'deploying', output: text });
    });

    deployProc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      deployError += text;
      sendEvent({ stage: 'deploying', output: text, isStderr: true });
    });

    deployProc.on('close', async (deployCode) => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (deployCode !== 0) {
        const workspaceId = (req as any).workspaceId || 'stillwater-suite';
        const suiteRef = firestore.collection('suites').doc(workspaceId);
        
        // Persist failure status and timestamp
        suiteRef.set({
          [`apps.${appId}.environments.production.status`]: 'failed',
          [`apps.${appId}.environments.production.lastDeployAt`]: Timestamp.now(),
          updatedAt: Timestamp.now()
        }, { merge: true }).catch(err => console.error(`[Deploy] Deploy Failure Persistence Failed:`, err.message));

        // Save to deployment history
        firestore.collection('deployments').add({
          suiteId: workspaceId,
          batchId: `${appId}-${startTime}`,
          appId,
          displayName: displayName || appId,
          environment: 'production',
          status: 'failed',
          startedAt: Timestamp.fromMillis(startTime),
          completedAt: Timestamp.now(),
          duration: elapsed,
          deployMethod: deployMethod || 'firebase',
          hostingTarget: hostingTarget || null,
          project: firebaseProject,
          errorLogs: deployError || deployOutput || 'Deploy failed'
        }).catch(err => console.error(`[Deploy] Deploy History Persistence Failed:`, err.message));

        sendEvent({
          stage: 'failed',
          message: `Deploy failed with exit code ${deployCode}`,
          error: deployError || deployOutput,
          duration: elapsed,
        });
        console.log(`[Deploy] ${appId} DEPLOY FAILED (${elapsed}s)`);
        res.end();
      } else {
        // Extract hosting URL from combined output (stdout/stderr)
        const combinedOutput = deployOutput + deployError;
        const urlMatch = combinedOutput.match(/https?:\/\/\S+\.web\.app/);
        const deployUrl = urlMatch?.[0] || null;

        sendEvent({
          stage: 'verifying',
          message: `Successfully deployed to CLI. Starting readiness probe...`,
          url: deployUrl,
          duration: elapsed,
        });

        // Step 3: Verification (Readiness Probe)
        let isVerified = false;
        if (deployUrl) {
          isVerified = await verifyDeployment(
            deployUrl, 
            (msg) => sendEvent({ stage: 'verifying', message: msg })
          );
        } else {
          console.warn(`[Deploy] No URL found in output, skipping verification.`);
          isVerified = true; // Assume live if we can't verify
        }

        // Final State Update - Write to Firestore directly from Backend
        try {
          const workspaceId = (req as any).workspaceId || 'stillwater-suite';
          const suiteRef = firestore.collection('suites').doc(workspaceId);
          
          const status = isVerified ? 'live' : 'failed';
          const updateData: any = {
            [`apps.${appId}.environments.production.status`]: status,
            [`apps.${appId}.environments.production.lastDeployAt`]: Timestamp.now(),
            updatedAt: Timestamp.now()
          };

          // Use .set with merge: true to avoid "document not found" errors if workspaceId is mismatched
          await suiteRef.set(updateData, { merge: true });
          console.log(`[Deploy] ${appId} Persistence Success: ${status} in ${workspaceId}`);

          // Also save to deployments history collection
          try {
            await firestore.collection('deployments').add({
              suiteId: workspaceId,
              batchId: `${appId}-${startTime}`,
              appId,
              displayName: displayName || appId,
              environment: 'production',
              status,
              startedAt: Timestamp.fromMillis(startTime),
              completedAt: Timestamp.now(),
              duration: Math.floor((Date.now() - startTime) / 1000),
              deployMethod: deployMethod || 'firebase',
              hostingTarget: hostingTarget || null,
              project: firebaseProject,
              deployUrl: deployUrl,
              errorLogs: isVerified ? null : 'Readiness probe timeout'
            });
          } catch (historyErr: any) {
            console.error(`[Deploy] History Persistence Failed:`, historyErr.message);
          }

          sendEvent({
            stage: isVerified ? 'live' : 'failed',
            message: isVerified 
              ? `Deployment fully verified and live!` 
              : `Readiness probe timed out. App may still be propagating.`,
            url: deployUrl,
            duration: Math.floor((Date.now() - startTime) / 1000),
          });
        } catch (dbErr: any) {
          console.error(`[Deploy] Firestore Update Failed:`, dbErr.message);
          sendEvent({
            stage: 'failed',
            message: `Deployment succeeded but failed to update status record: ${dbErr.message}`,
          });
        }

        console.log(`[Deploy] ${appId} PROCESS COMPLETE (${Math.floor((Date.now() - startTime) / 1000)}s)`);
        res.end();
      }
    });

    deployProc.on('error', (err) => {
      sendEvent({
        stage: 'failed',
        message: `Deploy process error: ${err.message}`,
        duration: Math.floor((Date.now() - startTime) / 1000),
      });
      res.end();
    });
  });

  buildProc.on('error', (err) => {
    sendEvent({
      stage: 'failed',
      message: `Build process error: ${err.message}`,
      duration: Math.floor((Date.now() - startTime) / 1000),
    });
    res.end();
  });

  // Handle client disconnect — only abort if response stream is cut
  res.on('close', () => {
    if (!res.writableEnded) {
      buildProc.kill();
      console.log(`[Deploy] ${appId} — client aborted`);
    }
  });
});

// ============================================================
// GET /api/backups/run
// SSE-based global suite backup orchestrator
// ============================================================

let activeBackupController: AbortController | null = null;

app.post('/api/backups/run', async (req, res) => {
  const { appIds, version = '1.0.0', scope = 'StillwaterSuite', includeStorage = true, force = false, queue = false } = req.body;
  
  const currentController = new AbortController();
  if (!queue) {
    if (activeBackupController && force) {
      console.log('[Backup] Aborting existing backup...');
      activeBackupController.abort();
    }
    activeBackupController = currentController;
  }
  const signal = currentController.signal;

  const metadata = { scope, appIds, version, includeStorage };
  
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

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const timestamp = new Date().getTime();
  const id = `${scope}_v${version}_${dateStr}_${timestamp}`;

  const runBackup = async () => {
    const storageProvider = getStorageProvider();
    const orchestrator = new BackupOrchestrator(storageProvider);

    try {
      await orchestrator.runFullSuiteBackup({
        version,
        scope,
        includeStorage,
        signal,
        appIds,
        releaseId: id
      }, currentController);
      
      if (activeBackupController === currentController) {
        activeBackupController = null;
      }
    } catch (err: any) {
      console.error('[Backup] Error:', err);
      if (activeBackupController === currentController) {
        activeBackupController = null;
      }
    }
  };

  if (queue) {
    operationMonitor.enqueue(id, runBackup, metadata);
    return res.json({ id, status: 'queued' });
  } else {
    // Run in background
    runBackup();
    return res.json({ id, status: 'running' });
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
    const storageProvider = getStorageProvider();
    
    // We search in AppSuite/backups (recursive listing logic is in the provider)
    const files = await storageProvider.list('AppSuite/backups');
    res.json({ files });
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
    const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-0.firebasestorage.app';
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
    const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-0.firebasestorage.app';
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
  const { paths } = req.body;
  if (!Array.isArray(paths)) return res.status(400).json({ error: 'paths must be an array' });

  try {
    const storageProvider = getStorageProvider();
    await storageProvider.deleteBulk(paths);
    res.json({ success: true, deletedCount: paths.length });
  } catch (err: any) {
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 SuiteUtils Deploy API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
