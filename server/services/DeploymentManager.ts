import { spawn, execFile, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs, { appendFileSync } from 'fs';
import path from 'path';

import os from 'os';
const DEBUG_LOG_PATH = path.join(process.cwd(), 'logs/deploy_debug.log');
const resolvePath = (p: string) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;

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
    envVars?: Record<string, string>;
}
import { suiteConfigManager } from './SuiteConfigManager.js';
import { workspaceManager } from './WorkspaceManager.js';

export class DeploymentManager extends EventEmitter {
    private activeJobs = new Map<string, DeploymentJob>();
    private processes = new Map<string, ChildProcess>();

    constructor() {
        super();
        const msg = `DeploymentManager initialized at ${new Date().toISOString()} (v8-ResilientPath)`;
        console.log(`[DeploymentManager] ${msg}`);
        fs.writeFileSync('GHOST_TEST.txt', msg);
    }

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
            logs: [`── Initializing ${deployMethod} deployment for ${appId} (v9-DirectSpawn)`],
            startedAt: Date.now(),
            workspaceId,
            deployMethod: deployMethod || 'firebase'
        };

        this.activeJobs.set(jobId, job);
        this.emit('update', job);

        const runBuild = () => {
            fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Spawning: npm run build in ${projectPath}\n`);
            this.appendLog(jobId, `── Starting local build (TRACER_BINGO): npm run build...`);

            const resolvedPath = resolvePath(projectPath);
            fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Project Path: ${projectPath} | Resolved: ${resolvedPath}\n`);

            try {
                if (!fs.existsSync(resolvedPath)) {
                    throw new Error(`Project path does not exist: ${resolvedPath}`);
                }

                // Automate cache-purging to avoid build conflicts
                const nextCachePath = path.join(resolvedPath, '.next');
                const viteCachePath = path.join(resolvedPath, 'dist');
                if (fs.existsSync(nextCachePath)) {
                    this.appendLog(jobId, `── Purging stale Next.js cache directory (.next)...`);
                    fs.rmSync(nextCachePath, { recursive: true, force: true });
                }
                if (fs.existsSync(viteCachePath)) {
                    this.appendLog(jobId, `── Purging stale build output directory (dist)...`);
                    fs.rmSync(viteCachePath, { recursive: true, force: true });
                }

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

                                    if (k.includes('PROJECT_ID') && v === 'heidless-apps-0' && firebaseProject === 'stillwater-sovereign-01') {
                                        return;
                                    }

                                    envVars[k] = v;
                                }
                            }
                        });
                        break;
                    }
                }
                job.envVars = envVars;

                const nodePath = process.execPath;
                const nodeBinDir = path.dirname(nodePath);
                let npmCliPath = path.join(nodeBinDir, '../lib/node_modules/npm/bin/npm-cli.js');
                
                // Fallback for some systems where it might be in a different place
                if (!fs.existsSync(npmCliPath)) {
                  npmCliPath = '/home/heidless/.nvm/versions/node/v22.22.2/lib/node_modules/npm/bin/npm-cli.js';
                }

                if (!fs.existsSync(npmCliPath)) {
                    throw new Error(`Could not locate npm-cli.js. Checked: ${npmCliPath}`);
                }

                this.appendLog(jobId, `── Starting local build (V8-RESILIENT): npm run build...`);
                this.appendLog(jobId, `── DEBUG: nodePath=${nodePath}`);
                this.appendLog(jobId, `── DEBUG: npmCliPath=${npmCliPath}`);
                
                // HARDEN ENVIRONMENT: Inject a robust PATH if it's missing or sparse
                const fallbackPath = [
                  nodeBinDir,
                  '/usr/local/sbin',
                  '/usr/local/bin',
                  '/usr/sbin',
                  '/usr/bin',
                  '/sbin',
                  '/bin'
                ].join(':');

                const finalEnv = { 
                  ...process.env, 
                  PATH: process.env.PATH ? `${process.env.PATH}:${fallbackPath}` : fallbackPath,
                  NODE_ENV: 'production',
                  ...envVars, 
                  FORCE_COLOR: '0' 
                };

                this.appendLog(jobId, `── DEBUG: PATH=${finalEnv.PATH.slice(0, 100)}...`);
                
                appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] Spawning (V8): ${nodePath} ${npmCliPath} run build in ${resolvedPath}\n`);
                appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] PATH: ${finalEnv.PATH}\n`);

                const buildProc = spawn(nodePath, [npmCliPath, 'run', 'build'], {
                    cwd: resolvedPath,
                    env: finalEnv
                });

                this.processes.set(jobId, buildProc);

                if (buildProc.stdout) {
                  buildProc.stdout.on('data', (chunk) => this.appendLog(jobId, chunk.toString()));
                }
                if (buildProc.stderr) {
                  buildProc.stderr.on('data', (chunk) => this.appendLog(jobId, chunk.toString(), true));
                }

                buildProc.on('error', (err) => {
                    this.appendLog(jobId, `\n── ERROR: Failed to start npm build (V7): ${err.message}`, true);
                    this.failJob(jobId, `Failed to start npm (V7): ${err.message}`);
                });

                buildProc.on('close', (code) => {
                    fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Local build finished with code ${code}\n`);
                    if (code !== 0) {
                        this.failJob(jobId, `Build failed with exit code ${code}`);
                    } else {
                        this.appendLog(jobId, `── Local build successful (Code 0)`);
                        appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] Local build SUCCESS for ${appId}. Proceeding to ${deployMethod} phase.\n`);

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
        appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] Entering runCloudRunDeploy for ${appId} (Job: ${jobId})\n`);
        const job = this.activeJobs.get(jobId);
        if (!job) {
          appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] ERROR: Job ${jobId} not found in runCloudRunDeploy (Check activeJobs map)\n`);
          return;
        }

        job.status = 'deploying';
        this.appendLog(jobId, `\n── Build complete. Starting Google Cloud Run deploy...`);
        this.emit('update', job);

        const envVars = job.envVars || {};

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

        const serviceName = appId === 'promptresources' ? 'ssrpromptresourcesv1' : appId;
        const deployArgs = [
            'run', 'deploy', serviceName,
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
            'NEXT_PUBLIC_FIREBASE_API_KEY',
            'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
            'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
            'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
            'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
            'NEXT_PUBLIC_FIREBASE_APP_ID',
            'NEXT_PUBLIC_FIREBASE_DATABASE_ID',
            'STRIPE_SECRET_KEY'
        ].filter(k => envVars[k]).map(k => `${k}=${envVars[k]}`).join(',');

        if (criticalVars) {
            deployArgs.push(`--set-build-env-vars=${criticalVars}`);
            deployArgs.push(`--set-env-vars=${criticalVars}`);
        }

        this.appendLog(jobId, `── Executing Cloud Run Deploy: gcloud run deploy ${serviceName} --project ${firebaseProject} (with env injection)`);

        fs.appendFileSync(path.join(process.cwd(), 'logs/deploy_debug.log'), `[DEBUG] Spawning: gcloud ${deployArgs.join(' ')}\n`);

        // HARDEN ENVIRONMENT
        const nodeBinDir = path.dirname(process.execPath);
        const fallbackPath = [
          nodeBinDir,
          '/usr/local/sbin',
          '/usr/local/bin',
          '/usr/sbin',
          '/usr/bin',
          '/sbin',
          '/bin'
        ].join(':');

        const finalEnv = {
          ...process.env,
          PATH: process.env.PATH ? `${process.env.PATH}:${fallbackPath}` : fallbackPath,
          FORCE_COLOR: '0'
        };

        // Try to find absolute gcloud path
        const gcloudPath = fs.existsSync('/usr/bin/gcloud') ? '/usr/bin/gcloud' : 'gcloud';

        this.appendLog(jobId, `── DEBUG: PATH=${finalEnv.PATH.slice(0, 100)}...`);
        appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] Spawning gcloud V8: ${gcloudPath} in ${resolvePath(projectPath)}\n`);
        appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] PATH: ${finalEnv.PATH}\n`);

        const deployProc = spawn(gcloudPath, deployArgs, {
            cwd: resolvePath(projectPath),
            env: finalEnv
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

        // Step 1: Use the project, Step 2: Deploy using the target name
        const target = hostingTarget || appId;
        const fullCommand = `npx -p firebase-tools firebase use ${firebaseProject} && npx -p firebase-tools firebase deploy --only hosting:${target} --project ${firebaseProject} --force`;
        
        this.appendLog(jobId, `── Identity Deploy: Pushing ${target} to ${firebaseProject}...`);

        const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS 
          ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS) 
          : undefined;

        const nodeBinDir = path.dirname(process.execPath);
        const fallbackPath = [
          nodeBinDir,
          '/usr/local/sbin',
          '/usr/local/bin',
          '/usr/sbin',
          '/usr/bin',
          '/sbin',
          '/bin'
        ].join(':');

        const finalEnv: Record<string, string | undefined> = { 
          ...process.env, 
          PATH: process.env.PATH ? `${process.env.PATH}:${fallbackPath}` : fallbackPath,
          GOOGLE_CLOUD_PROJECT: firebaseProject,
          FIREBASE_PROJECT: firebaseProject
        };

        if (saPath) {
          finalEnv.GOOGLE_APPLICATION_CREDENTIALS = saPath;
        }

        const deployProc = spawn('sh', ['-c', fullCommand], {
            cwd: resolvePath(projectPath),
            env: finalEnv
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

    private getCanonicalUrl(appId: string, workspaceId: string): string | null {
        const MAPPING: Record<string, string> = {
            'promptresources': 'https://stillwater-prompt-resources.web.app',
            'prompttool': 'https://stillwater-prompt-tool.web.app',
            'suiteutils': 'https://stillwater-suite-utils.web.app',
            'promptmasterspa': 'https://stillwater-prompt-master.web.app',
            'promptaccreditation': 'https://stillwater-prompt-accreditation.web.app',
            'plantune': 'https://plantune-v0.web.app',
            'persona': 'https://persona-v0.web.app',
            'urlshortener': 'https://stillwater-url-shortener.web.app',
            'ag-video-system': 'https://heidless-video-system.web.app'
        };

        try {
            const ws = workspaceManager.getWorkspace(workspaceId);
            const app = ws?.apps.find((a: any) => a.id === appId);
            if (app?.deployUrl) {
                return app.deployUrl;
            }
            if (MAPPING[appId]) return MAPPING[appId];
            if (app?.hostingTarget) {
                return `https://${app.hostingTarget}.web.app`;
            }
        } catch {
            if (MAPPING[appId]) return MAPPING[appId];
        }

        return null;
    }

    public appendLog(jobId: string, text: string, isError: boolean = false) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            if (job.status === 'live' || job.status === 'failed') return;
            job.logs.push(text);

            const urlMatch = text.match(/https?:\/\/\S+\.(?:web\.app|run\.app)/);
            if (urlMatch) {
                const canonical = this.getCanonicalUrl(job.appId, job.workspaceId);
                job.url = canonical || urlMatch[0];
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
            
            const canonical = this.getCanonicalUrl(job.appId, job.workspaceId);
            if (canonical) {
                job.url = canonical;
            }
            
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

    public readonly APP_SCRIPT_MAP: Record<string, string> = {
        'ag-video-system': 'video',
        'prompttool': 'prompttool',
        'promptresources': 'resources',
        'promptmasterspa': 'master',
        'promptaccreditation': 'accreditation',
        'plantune': 'plantune',
        'suiteutils': 'utils',
        'persona': 'persona',
        'urlshortener': 'urlshortener'
    };

    public async startLocalApp(appId: string, workspaceId: string = 'stillwater-suite'): Promise<void> {
        const ws = workspaceManager.getWorkspace(workspaceId);
        const app = ws?.apps.find(a => a.id === appId);
        if (!app) throw new Error(`App ${appId} not found in workspace ${workspaceId}`);

        const scriptPrefix = this.APP_SCRIPT_MAP[appId] || appId;
        const scriptPath = path.join(process.cwd(), `${scriptPrefix}-ctl.sh`);
        
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Control script not found for ${appId} (Expected: ${scriptPath})`);
        }

        // Enable in config so Watchdog monitors it
        suiteConfigManager.setModuleEnabled(scriptPrefix, true);

        return new Promise((resolve, reject) => {
            const proc = spawn('/bin/bash', [scriptPath, 'start']);
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Failed to start ${appId} (Exit Code: ${code})`));
            });
        });
    }

    public async stopLocalApp(appId: string): Promise<void> {
        const scriptPrefix = this.APP_SCRIPT_MAP[appId] || appId;
        const scriptPath = path.join(process.cwd(), `${scriptPrefix}-ctl.sh`);
        
        // Disable in config so Watchdog ignores it
        suiteConfigManager.setModuleEnabled(scriptPrefix, false);

        return new Promise((resolve, reject) => {
            const proc = spawn('/bin/bash', [scriptPath, 'stop']);
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Failed to stop ${appId} (Exit Code: ${code})`));
            });
        });
    }

    public async restartLocalApp(appId: string): Promise<void> {
        const scriptPrefix = this.APP_SCRIPT_MAP[appId] || appId;
        const scriptPath = path.join(process.cwd(), `${scriptPrefix}-ctl.sh`);
        return new Promise((resolve, reject) => {
            const proc = spawn('/bin/bash', [scriptPath, 'restart']);
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Failed to restart ${appId} (Exit Code: ${code})`));
            });
        });
    }

    public async bulkToggleLocalApps(appIds: string[], enabled: boolean): Promise<void> {
        const scriptPrefixes = appIds.map(id => this.APP_SCRIPT_MAP[id] || id);
        
        // 1. Update config first (so Watchdog knows what to do)
        suiteConfigManager.setModulesEnabled(scriptPrefixes, enabled);

        // 2. Perform process actions
        const action = enabled ? 'start' : 'stop';
        const results = await Promise.allSettled(
            appIds.map(appId => {
                const scriptPrefix = this.APP_SCRIPT_MAP[appId] || appId;
                const scriptPath = path.join(process.cwd(), `${scriptPrefix}-ctl.sh`);
                return new Promise<void>((resolve, reject) => {
                    const proc = spawn('/bin/bash', [scriptPath, action]);
                    proc.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`Failed to ${action} ${appId}`));
                    });
                });
            })
        );

        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
            console.error(`[DeploymentManager] Bulk ${action} partially failed:`, failed);
        }
    }

    public getLocalLogs(appId: string, lines: number = 50): string {
        const scriptPrefix = this.APP_SCRIPT_MAP[appId] || appId;
        const logFile = path.join(process.cwd(), `${scriptPrefix}.log`);
        if (!fs.existsSync(logFile)) return '[No log file found]';
        
        try {
            const content = fs.readFileSync(logFile, 'utf8');
            const linesArr = content.split('\n');
            return linesArr.slice(-lines).join('\n');
        } catch (err) {
            return `[Error reading logs: ${err}]`;
        }
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
