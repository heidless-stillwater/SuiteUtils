import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { healthScanner } from './HealthScanner.js';
import { auditLogger } from './AuditLogger.js';
import { settingsManager } from './SettingsManager.js';

export interface ReleaseOptions {
  appId: string;
  ref: string;
  env: 'production' | 'staging' | 'dev';
  onProgress?: (data: { message: string; type: 'info' | 'error' | 'success' | 'cancelled' }) => void;
  signal?: AbortSignal;
}

export class ReleaseManager {
  private worktreeRoot: string;
  private buildQueue: { options: ReleaseOptions; resolve: Function; reject: Function }[] = [];
  private activeBuilds: number = 0;
  private maxConcurrentBuilds: number = 3;
  private activeProcesses = new Map<string, ChildProcess>();

  constructor() {
    this.worktreeRoot = path.join(process.cwd(), 'worktrees');
  }

  async enqueueRelease(options: ReleaseOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buildQueue.push({ options, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeBuilds >= this.maxConcurrentBuilds || this.buildQueue.length === 0) return;
    
    const task = this.buildQueue.shift();
    if (task) {
      this.activeBuilds++;
      const { options, resolve, reject } = task;
      
      // Fire and forget the individual build, but track it
      this.processRelease(options).then(() => {
        this.activeBuilds--;
        resolve();
        this.processQueue(); // Check for more tasks
      }).catch((err) => {
        this.activeBuilds--;
        reject(err);
        this.processQueue(); // Check for more tasks
      });

      // Try to start another if slots available
      this.processQueue();
    }
  }

  private async processRelease(options: ReleaseOptions) {
    const { appId, ref, env, onProgress, signal } = options;
    const worktreePath = path.join(this.worktreeRoot, `${appId}_${env}_${Date.now()}`);
    
    if (signal?.aborted) throw new Error('Release cancelled before start');

    try {
      await fs.ensureDir(this.worktreeRoot);
      
      // 0. Pre-flight health check
      onProgress?.({ message: `🔍 Running pre-flight health check for ${appId}...`, type: 'info' });
      const health = await healthScanner.checkApp(appId);
      const settings = settingsManager.getSettings();

      if (health.status === 'DOWN') {
        if (settings.strictMode) {
          throw new Error(`STRICT MODE: Deployment blocked because ${appId} is DOWN.`);
        }
        onProgress?.({ message: `⚠️ App ${appId} is currently DOWN. Proceeding with caution...`, type: 'info' });
      }

      onProgress?.({ message: `🌿 Creating isolated worktree for ${appId} (${ref})...`, type: 'info' });
      await this.runCommand('git', ['worktree', 'add', worktreePath, ref], appId, worktreePath, signal);

      onProgress?.({ message: `📦 Installing dependencies (npm ci)...`, type: 'info' });
      await this.runCommand('npm', ['ci'], appId, worktreePath, signal);

      onProgress?.({ message: `🏗️ Building application...`, type: 'info' });
      await this.runCommand('npm', ['run', 'build'], appId, worktreePath, signal);

      onProgress?.({ message: `🚀 Deploying to ${env}...`, type: 'info' });
      await new Promise((r, rej) => {
        const timeout = setTimeout(r, 2000);
        const onAbort = () => {
          clearTimeout(timeout);
          rej(new Error('Cancelled during deploy simulation'));
        };
        signal?.addEventListener('abort', onAbort);
      });

      onProgress?.({ message: `✅ Release successfully deployed!`, type: 'success' });
      
      await auditLogger.log({
        type: 'release',
        action: `Deploy ${appId}`,
        status: 'success',
        details: `Deployed ${ref} to ${env} (Isolated Build)`,
        appId
      });

    } catch (err: any) {
      if (signal?.aborted) {
        onProgress?.({ message: `🛑 Release cancelled by user.`, type: 'cancelled' });
        await auditLogger.log({
          type: 'release',
          action: `Deploy ${appId}`,
          status: 'cancelled',
          details: `User cancelled deployment of ${ref}`,
          appId
        });
      } else {
        onProgress?.({ message: `❌ Release failed: ${err.message}`, type: 'error' });
        await auditLogger.log({
          type: 'release',
          action: `Deploy ${appId}`,
          status: 'failure',
          details: `Deployment failed: ${err.message}`,
          appId
        });
      }
      throw err;
    } finally {
      onProgress?.({ message: `🧹 Cleaning up worktree...`, type: 'info' });
      // Cleanup is force-run regardless of cancellation
      await this.runCommand('git', ['worktree', 'remove', worktreePath, '--force'], appId).catch(() => {});
      await fs.remove(worktreePath).catch(() => {});
    }
  }

  private runCommand(cmd: string, args: string[], appId: string, cwd?: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Cancelled'));

      const proc = spawn(cmd, args, { 
        cwd: cwd || process.cwd(),
        shell: true,
        detached: true 
      });

      this.activeProcesses.set(appId, proc);

      const onAbort = () => {
        if (proc.pid) {
          try {
            process.kill(-proc.pid, 'SIGKILL');
          } catch (e) {
            proc.kill('SIGKILL');
          }
        }
        reject(new Error('Cancelled'));
      };

      signal?.addEventListener('abort', onAbort);

      proc.stdout.on('data', (data) => {
        console.log(`[${appId}][${cmd}] ${data.toString().trim()}`);
      });

      proc.on('close', (code) => {
        signal?.removeEventListener('abort', onAbort);
        this.activeProcesses.delete(appId);
        if (code === 0) resolve();
        else reject(new Error(`Command ${cmd} failed with code ${code}`));
      });
    });
  }
}
