import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface DeploymentJob {
    id: string;
    appId: string;
    status: 'building' | 'deploying' | 'verifying' | 'live' | 'failed';
    logs: string[];
    startedAt: number;
    workspaceId: string;
    duration?: number;
    error?: string;
    url?: string;
}

class DeploymentManager extends EventEmitter {
    private activeJobs = new Map<string, DeploymentJob>();
    private processes = new Map<string, ChildProcess>();

    startDeploy(jobId: string, appId: string, projectPath: string, hostingTarget: string | null, firebaseProject: string, workspaceId: string) {
        // Check for existing active job for this appId to prevent race conditions
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
            logs: [`── Initializing deployment for ${appId}`],
            startedAt: Date.now(),
            workspaceId
        };

        this.activeJobs.set(jobId, job);
        this.emit('update', job);

        const runBuild = () => {
            const buildProc = spawn('npm', ['run', 'build'], {
                cwd: projectPath,
                shell: '/bin/bash',
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

            buildProc.on('close', (code) => {
                if (code !== 0) {
                    this.failJob(jobId, `Build failed with exit code ${code}`);
                } else {
                    this.runFirebaseDeploy(jobId, appId, projectPath, hostingTarget, firebaseProject);
                }
            });
        };

        runBuild();
    }

    private runFirebaseDeploy(jobId: string, appId: string, projectPath: string, hostingTarget: string | null, firebaseProject: string) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;

        job.status = 'deploying';
        this.appendLog(jobId, `\n── Build complete. Starting Firebase deploy...`);
        this.emit('update', job);

        if (!hostingTarget) {
            this.failJob(jobId, 'No hosting target specified');
            return;
        }

        const deployArgs = [
            'deploy',
            '--only', `hosting:${hostingTarget}`,
            '--project', firebaseProject,
        ];

        const localFirebase = path.join(projectPath, 'node_modules', '.bin', 'firebase');
        const firebaseCmd = fs.existsSync(localFirebase) ? localFirebase : 'firebase';

        const deployProc = spawn(firebaseCmd, deployArgs, {
            cwd: projectPath,
            shell: '/bin/bash',
            env: { ...process.env, FORCE_COLOR: '0' }
        });

        this.processes.set(jobId, deployProc);

        deployProc.stdout.on('data', (chunk) => this.appendLog(jobId, chunk.toString()));
        deployProc.stderr.on('data', (chunk) => this.appendLog(jobId, chunk.toString(), true));

        deployProc.on('close', (code) => {
            if (code !== 0) {
                this.failJob(jobId, `Deploy failed with exit code ${code}`);
            } else {
                // Transition to verifying stage
                const job = this.activeJobs.get(jobId);
                if (job) {
                    job.status = 'verifying';
                    job.logs.push(`\n── Deploy complete. Entering verification phase...`);
                    this.emit('update', job);
                    this.processes.delete(jobId);
                }
            }
        });
    }

    private appendLog(jobId: string, text: string, isError = false) {
        const job = this.activeJobs.get(jobId);
        if (job) {
            if (job.status === 'live' || job.status === 'failed') return;
            job.logs.push(text);
            
            // Extract hosting URL if found in logs
            const urlMatch = text.match(/https?:\/\/\S+\.web\.app/);
            if (urlMatch) {
                job.url = urlMatch[0];
            }

            if (job.logs.length > 2000) job.logs.shift(); // Prevent memory leaks
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
            
            // Keep failed jobs for 10 minutes then clear
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

            // Keep live jobs for 5 minutes then clear
            setTimeout(() => this.activeJobs.delete(jobId), 300000);
        }
    }

    public stopDeploy(jobId: string) {
        console.log(`[DeploymentManager] Attempting to cancel job: ${jobId}`);
        const process = this.processes.get(jobId);
        const job = this.activeJobs.get(jobId);

        if (process) {
            console.log(`[DeploymentManager] Killing process PID: ${process.pid}`);
            process.kill('SIGKILL'); // Use SIGKILL for immediate effect
            this.processes.delete(jobId);
            
            if (job) {
                job.status = 'failed';
                job.error = 'Deployment cancelled by user';
                job.logs.push('\n── 🛑 Deployment FORCE CANCELLED by User');
                this.emit('update', job);
                
                // Clean up job after a delay so UI can show the failure
                setTimeout(() => this.activeJobs.delete(jobId), 5000);
            }
            return true;
        }

        console.warn(`[DeploymentManager] No active process found for jobId: ${jobId}`);
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
}

export const deploymentManager = new DeploymentManager();
