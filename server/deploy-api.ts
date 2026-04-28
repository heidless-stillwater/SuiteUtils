import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { GoogleAuth } from 'google-auth-library';

const app = express();
const PORT = 5181;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Resolve ~ to home directory
function resolvePath(p: string): string {
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
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
  const { appId, projectPath, hostingTarget, project, deployMethod } = req.body;

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

    const deployProc = spawn('firebase', deployArgs, {
      cwd: resolvedPath,
      shell: '/bin/bash',
      env: { ...process.env, FORCE_COLOR: '0' },
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

    deployProc.on('close', (deployCode) => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (deployCode !== 0) {
        sendEvent({
          stage: 'failed',
          message: `Deploy failed with exit code ${deployCode}`,
          error: deployError || deployOutput,
          duration: elapsed,
        });
        console.log(`[Deploy] ${appId} DEPLOY FAILED (${elapsed}s)`);
      } else {
        // Extract hosting URL from output
        const urlMatch = deployOutput.match(/https?:\/\/\S+\.web\.app/);
        sendEvent({
          stage: 'live',
          message: `Successfully deployed ${appId}`,
          url: urlMatch?.[0] || null,
          duration: elapsed,
        });
        console.log(`[Deploy] ${appId} LIVE (${elapsed}s)`);
      }

      res.end();
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 SuiteUtils Deploy API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
