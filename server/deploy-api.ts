import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
