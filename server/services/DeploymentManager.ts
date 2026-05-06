import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

const resolvePath = (p: string) => p.replace(/^~/, process.env.HOME || '');

export interface DeploymentJob {
    id: string;
    appId: string;
    status: 'building' | 'deploying' | 'verifying' | 'live' | 'failed';
    logs: string[];
    startedAt: number;
    workspaceId: string;
    deployMethod: string;
    duration?: number;
    error?: string;
    url?: string;
}

class DeploymentManager extends EventEmitter {
    private activeJobs = new Map<string, DeploymentJob>();
    private processes = new Map<string, ChildProcess>();

    startDeploy(jobId: string, appId: string, projectPath: string, hostingTarget: string | null, firebaseProject: string, workspaceId: string, deployMethod: string = 'firebase') {
        const existingJob = Array.from(this.activeJobs.values()).find(
            j => j.appId === appId && (j.status === 'building' || j.status === 'deploying' || j.status === 'verifying')
        );
        if (existingJob) {
            throw new Error(`Deployment already in progress for ${appId} (Job: ${existingJob.id})`);
        }

        const job: DeploymentJob = {
            id: jobId,
            appId,
            status: 'building',
            logs: [`── Initializing ${deployMethod} deployment for ${appId}`],
            startedAt: Date.now(),
            workspaceId,
            deployMethod: deployMethod || 'firebase'
        };

        this.activeJobs.set(jobId, job);
        this.emit('update', job);

        const runBuild = () => {
            // We now force local build even for cloud-run to support high-speed standalone container builds
            // which rely on locally generated .next/standalone artifacts.

            fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Spawning: npm run build in ${projectPath}\n`);
            this.appendLog(jobId, `── Starting local build: npm run build...`);
            fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Project Path: ${projectPath} | Resolved: ${resolvePath(projectPath)}\n`);

            try {
                const buildProc = spawn('npm', ['run', 'build'], {
                    cwd: resolvePath(projectPath),
                    shell: true,
                    env: { 
                      ...process.env, 
                      FORCE_COLOR: '0',
                      CPUS: '1',
                      NODE_OPTIONS: '--max-old-space-size=4096'
                    }
                });

                this.processes.set(jobId, buildProc);

                buildProc.stdout.on('data', (chunk) => this.appendLog(jobId, chunk.toString()));
                buildProc.stderr.on('data', (chunk) => this.appendLog(jobId, chunk.toString(), true));

                buildProc.on('error', (err) => {
                    this.appendLog(jobId, `\n── ERROR: Failed to start npm build: ${err.message}`, true);
                    this.failJob(jobId, `Failed to start npm: ${err.message}`);
                });

                buildProc.on('close', (code) => {
                    fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Local build finished with code ${code}\n`);
                    if (code !== 0) {
                        this.failJob(jobId, `Build failed with exit code ${code}`);
                    } else {
                        if (deployMethod === 'cloud-build' || deployMethod === 'cloud-run') {
                            this.runCloudRunDeploy(jobId, appId, projectPath, firebaseProject);
                        } else {
                            this.runFirebaseDeploy(jobId, appId, projectPath, hostingTarget, firebaseProject);
                        }
                    }
                });
            } catch (err: any) {
                this.appendLog(jobId, `\n── EXCEPTION during spawn: ${err.message}`, true);
                this.failJob(jobId, `Spawn exception: ${err.message}`);
            }
        };

        runBuild();
    }

    private runCloudRunDeploy(jobId: string, appId: string, projectPath: string, firebaseProject: string) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;

        job.status = 'deploying';
        this.appendLog(jobId, `\n── Build complete. Starting Google Cloud Run deploy...`);
        this.emit('update', job);

        // Load environment variables for build-time injection
        const envVars: Record<string, string> = {};
        const envPaths = ['.env.production', '.env.local', '.env'];
        
        for (const envFile of envPaths) {
          const fullPath = path.join(resolvePath(projectPath), envFile);
          if (fs.existsSync(fullPath)) {
            this.appendLog(jobId, `── Detected ${envFile}, filtering build-time variables...`);
            const content = fs.readFileSync(fullPath, 'utf8');
            content.split('\n').forEach(line => {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=');
                if (key && value) {
                  const k = key.trim();
                  const v = value.trim().replace(/^["']|["']$/g, '');
                  
                  // Skip keys that point to the wrong project
                  if (k.includes('PROJECT_ID') && v === 'heidless-apps-0' && firebaseProject === 'heidless-apps-2') {
                    return;
                  }
                  
                  envVars[k] = v;
                }
              }
            });
            break; 
          }
        }

        // FORCE CORRECT PROJECT ID
        envVars['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] = firebaseProject;
        envVars['FIREBASE_PROJECT_ID'] = firebaseProject;
        
        // Ensure STRIPE_SECRET_KEY has at least a valid-looking placeholder if missing
        if (!envVars['STRIPE_SECRET_KEY']) {
          envVars['STRIPE_SECRET_KEY'] = 'sk_test_placeholder_forced';
        }

        // Write to a temporary .env.deploy file in the project directory
        // This is safer than passing hundreds of characters in the command line
        const envFilePath = path.join(resolvePath(projectPath), '.env.deploy');
        const envContent = Object.entries(envVars)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n');
        
        try {
          fs.writeFileSync(envFilePath, envContent);
          this.appendLog(jobId, `── Created .env.deploy with ${Object.keys(envVars).length} variables.`);
        } catch (err: any) {
          this.appendLog(jobId, `── Warning: Failed to create .env.deploy: ${err.message}`);
        }

        const deployArgs = [
            'run', 'deploy', appId,
            '--source', '.',
            '--platform', 'managed',
            '--region', 'us-central1',
            '--project', firebaseProject,
            '--allow-unauthenticated',
            '--clear-base-image',
            '--quiet'
        ];

        // We still use the flags for the most critical ones, but the .env.deploy 
        // will be picked up by the Dockerfile (if we update it) or by Next.js
        const criticalVars = [
          'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
          'FIREBASE_PROJECT_ID',
          'STRIPE_SECRET_KEY',
          'NEXT_PUBLIC_FIREBASE_API_KEY',
          'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
          'NEXT_PUBLIC_FIREBASE_APP_ID'
        ].filter(k => envVars[k]).map(k => `${k}=${envVars[k]}`).join(',');

        deployArgs.push(`--set-build-env-vars=${criticalVars}`);
        deployArgs.push(`--set-env-vars=${criticalVars}`);

        this.appendLog(jobId, `── Executing Cloud Run Deploy: gcloud run deploy ${appId} --project ${firebaseProject} (with env injection)`);
        
        fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Spawning: gcloud ${deployArgs.join(' ')}\n`);
        
        const deployProc = spawn('gcloud', deployArgs, {
            cwd: resolvePath(projectPath),
            shell: true,
            env: { ...process.env, FORCE_COLOR: '0' }
        });

        fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Spawned gcloud PID: ${deployProc.pid}\n`);

        this.processes.set(jobId, deployProc);

        deployProc.stdout.on('data', (chunk) => this.appendLog(jobId, chunk.toString()));
        deployProc.stderr.on('data', (chunk) => this.appendLog(jobId, chunk.toString(), true));

        deployProc.on('error', (err) => {
            this.appendLog(jobId, `\n── ERROR: Failed to start gcloud process: ${err.message}`, true);
            this.failJob(jobId, `Failed to start gcloud: ${err.message}`);
        });

        deployProc.on('close', (code) => {
            if (code !== 0) {
                this.failJob(jobId, `Cloud Run deploy failed with exit code ${code}`);
            } else {
                const job = this.activeJobs.get(jobId);
                if (job) {
                    job.status = 'verifying';
                    job.logs.push(`\n── Cloud Run deploy command finished (Exit Code: 0).`);
                    job.logs.push(`── Entering verification phase...`);
                    this.emit('update', job);
                    this.processes.delete(jobId);
                }
            }
        });
    }

    private runFirebaseDeploy(jobId: string, appId: string, projectPath: string, hostingTarget: string | null, firebaseProject: string) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;

        job.status = 'deploying';
        this.appendLog(jobId, `\n── Build complete. Starting Firebase Hosting deploy...`);
        this.emit('update', job);

        const deployArgs = ['deploy', '--only', `hosting:${hostingTarget || appId}`, '--project', firebaseProject, '--force'];
        const deployProc = spawn('firebase', deployArgs, {
            cwd: resolvePath(projectPath),
            shell: '/bin/bash'
        });

        this.processes.set(jobId, deployProc);

        deployProc.stdout.on('data', (chunk) => this.appendLog(jobId, chunk.toString()));
        deployProc.stderr.on('data', (chunk) => this.appendLog(jobId, chunk.toString(), true));

        deployProc.on('close', (code) => {
            if (code !== 0) {
                this.failJob(jobId, `Firebase deploy failed with exit code ${code}`);
            } else {
                this.finishJob(jobId);
            }
        });
    }

    public appendLog(jobId: string, text: string, isError: boolean = false) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            if (job.status === 'live' || job.status === 'failed') return;
            job.logs.push(text);
            
            const urlMatch = text.match(/https?:\/\/\S+\.(?:web\.app|run\.app)/);
            if (urlMatch) {
                job.url = urlMatch[0];
            }

            if (job.logs.length > 2000) job.logs.shift();
            this.emit('update', job);
        }
    }

    public failJob(jobId: string, error: string) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            if (job.status === 'live' || job.status === 'failed') return;
            job.status = 'failed';
            job.error = error;
            job.duration = Math.floor((Date.now() - job.startedAt) / 1000);
            job.logs.push(`\n── ERROR: ${error}`);
            this.processes.delete(jobId);
            this.emit('update', job);
            setTimeout(() => this.activeJobs.delete(jobId), 600000);
        }
    }

    public finishJob(jobId: string) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            if (job.status === 'live' || job.status === 'failed') return;
            job.status = 'live';
            job.duration = Math.floor((Date.now() - job.startedAt) / 1000);
            job.logs.push(`\n── Deployment successful and live!`);
            this.processes.delete(jobId);
            this.emit('update', job);
            setTimeout(() => this.activeJobs.delete(jobId), 300000);
        }
    }

    public stopDeploy(jobId: string) {
        const process = this.processes.get(jobId);
        const job = this.activeJobs.get(jobId);

        if (process) {
            process.kill('SIGKILL');
            this.processes.delete(jobId);
            
            if (job) {
                job.status = 'failed';
                job.error = 'Deployment cancelled by user';
                job.logs.push('\n── 🛑 Deployment FORCE CANCELLED by User');
                this.emit('update', job);
                setTimeout(() => this.activeJobs.delete(jobId), 5000);
            }
            return true;
        }
        return false;
    }

    public getActiveJobs(): DeploymentJob[] {
        return Array.from(this.activeJobs.values());
    }

    cancelJob(jobId: string) {
        const proc = this.processes.get(jobId);
        if (proc) {
            proc.kill();
            this.failJob(jobId, 'Deployment cancelled by user');
        }
    }

    public clearAllJobs() {
        this.processes.forEach(proc => proc.kill('SIGKILL'));
        this.processes.clear();
        this.activeJobs.clear();
    }
}

export const deploymentManager = new DeploymentManager();
