import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import { BackupOrchestrator } from './BackupOrchestrator.js';
import { GCSStorageProvider } from './GCSStorageProvider.js';
import { auditLogger } from './AuditLogger.js';
import { operationMonitor } from './OperationMonitor.js';

export interface BackupSchedule {
  id: string;
  name?: string;
  cronExpression: string; // e.g. "0 0 * * *"
  scope: string;
  includeStorage: boolean;
  appIds?: string[];
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused';
}

export class ScheduleManager {
  private configPath: string;
  private jobs: Map<string, ScheduledTask> = new Map();
  private activeControllers: Map<string, AbortController> = new Map();
  private orchestrator: BackupOrchestrator;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'schedules.json');
    fs.ensureDirSync(path.dirname(this.configPath));
    
    // Initialize Orchestrator using environment variables
    const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-0.firebasestorage.app';
    const credentialsPath = path.join(process.cwd(), 'server/config/service-account.json');
    
    const storage = new GCSStorageProvider(bucketName, credentialsPath);
    this.orchestrator = new BackupOrchestrator(storage);

    if (!fs.existsSync(this.configPath)) {
      fs.writeJsonSync(this.configPath, []);
    }
  }

  async init() {
    const schedules = await this.getSchedules();
    console.log(`[Scheduler] Initializing ${schedules.length} schedules...`);
    schedules.forEach(s => {
      if (s.status === 'active') {
        this.scheduleJob(s);
      }
    });
  }

  async getSchedules(): Promise<BackupSchedule[]> {
    try {
      return await fs.readJson(this.configPath);
    } catch {
      return [];
    }
  }

  async addSchedule(schedule: Omit<BackupSchedule, 'id' | 'status'>): Promise<BackupSchedule> {
    const schedules = await this.getSchedules();
    const newSchedule: BackupSchedule = {
      ...schedule,
      id: Math.random().toString(36).substring(7),
      status: 'active'
    };

    schedules.push(newSchedule);
    await fs.writeJson(this.configPath, schedules, { spaces: 2 });
    this.scheduleJob(newSchedule);
    
    await auditLogger.log({
      type: 'system',
      action: 'Add Backup Schedule',
      status: 'success',
      details: `Scheduled ${newSchedule.scope} backup with cron: ${newSchedule.cronExpression}`
    });

    return newSchedule;
  }

  async updateSchedule(id: string, updates: Partial<BackupSchedule>) {
    const schedules = await this.getSchedules();
    const idx = schedules.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Schedule not found');

    schedules[idx] = { ...schedules[idx], ...updates };
    await fs.writeJson(this.configPath, schedules, { spaces: 2 });

    // If cron changed, reschedule
    if (updates.cronExpression) {
       const job = this.jobs.get(id);
       if (job) job.stop();
       this.scheduleJob(schedules[idx]);
    }

    return schedules[idx];
  }

  async deleteSchedule(id: string) {
    const schedules = await this.getSchedules();
    const filtered = schedules.filter(s => s.id !== id);
    await fs.writeJson(this.configPath, filtered, { spaces: 2 });
    
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }

    await auditLogger.log({
      type: 'system',
      action: 'Delete Backup Schedule',
      status: 'info',
      details: `Removed schedule ${id}`
    });
  }

  async togglePause(id: string) {
    const schedules = await this.getSchedules();
    const idx = schedules.findIndex(s => s.id === id);
    if (idx === -1) return;

    const s = schedules[idx];
    s.status = s.status === 'active' ? 'paused' : 'active';
    
    await fs.writeJson(this.configPath, schedules, { spaces: 2 });

    const job = this.jobs.get(id);
    if (s.status === 'active') {
      this.scheduleJob(s);
    } else if (job) {
      job.stop();
      this.jobs.delete(id);
    }

    await auditLogger.log({
      type: 'system',
      action: s.status === 'active' ? 'Resume Schedule' : 'Pause Schedule',
      status: 'info',
      details: `${s.status === 'active' ? 'Resumed' : 'Paused'} backup routine ${id}`
    });
  }

  private scheduleJob(s: BackupSchedule) {
    if (!cron.validate(s.cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression: ${s.cronExpression}`);
      return;
    }

    const job = cron.schedule(s.cronExpression, async () => {
      const metadata = { scope: s.scope, appIds: s.appIds, version: 'auto-sched', includeStorage: s.includeStorage };
      
      // Check for conflicts before running
      const conflict = operationMonitor.findIdenticalOperation('backup', metadata);
      if (conflict) {
        console.log(`[Scheduler] Skipping scheduled backup: ${s.id} (${s.scope}) - An identical job is already running (${conflict.id})`);
        await auditLogger.log({
          type: 'system',
          action: 'Scheduled Backup Skipped',
          status: 'info',
          details: `Skipped scheduled run for ${s.scope} because an identical job is already in progress.`
        });
        return;
      }

      console.log(`[Scheduler] Running scheduled backup: ${s.id} (${s.scope})`);
      const controller = new AbortController();
      this.activeControllers.set(s.id, controller);
      
      try {
        await this.orchestrator.runFullSuiteBackup({
          scope: s.scope,
          includeStorage: s.includeStorage,
          appIds: s.appIds,
          version: 'auto-sched',
          signal: controller.signal
        }, controller);
        
        // Update last run time
        const schedules = await this.getSchedules();
        const idx = schedules.findIndex(item => item.id === s.id);
        if (idx !== -1) {
          schedules[idx].lastRun = new Date().toISOString();
          await fs.writeJson(this.configPath, schedules, { spaces: 2 });
        }

      } catch (err: any) {
        if (err.message !== 'Backup cancelled') {
          console.error(`[Scheduler] Scheduled backup failed: ${err.message}`);
          await auditLogger.log({
            type: 'backup',
            action: 'Scheduled Backup Run',
            status: 'failure',
            details: `Scheduled run failed: ${err.message}`,
            appId: 'StillwaterSuite'
          });
        }
      } finally {
        this.activeControllers.delete(s.id);
      }
    });

    this.jobs.set(s.id, job);
  }
}

export const scheduleManager = new ScheduleManager();
