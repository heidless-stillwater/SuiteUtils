import fs from 'fs-extra';
import path from 'path';
import { notificationManager } from './NotificationManager.js';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: 'backup' | 'restore' | 'release' | 'system';
  action: string;
  status: 'success' | 'failure' | 'info' | 'cancelled';
  details: string;
  appId?: string;
  user?: string;
}

export class AuditLogger {
  private logPath: string;

  constructor() {
    this.logPath = path.join(process.cwd(), 'logs', 'audit.json');
    fs.ensureDirSync(path.dirname(this.logPath));
    if (!fs.existsSync(this.logPath)) {
      fs.writeJsonSync(this.logPath, []);
    } else {
      // Migration: Add IDs to existing logs that don't have them
      try {
        const logs = fs.readJsonSync(this.logPath);
        let changed = false;
        logs.forEach((l: any) => {
          if (!l.id) {
            l.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            changed = true;
          }
        });
        if (changed) {
          fs.writeJsonSync(this.logPath, logs, { spaces: 2 });
        }
      } catch (e) {
        console.error('Failed to migrate audit logs:', e);
      }
    }
  }

  async log(event: Omit<AuditEvent, 'timestamp' | 'id'>) {
    const fullEvent: AuditEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      timestamp: new Date().toISOString(),
    };

    try {
      const logs = await fs.readJson(this.logPath);
      logs.push(fullEvent);
      // Keep only last 1000 logs for performance
      const trimmedLogs = logs.slice(-1000);
      await fs.writeJson(this.logPath, trimmedLogs, { spaces: 2 });
      console.log(`[Audit] ${fullEvent.action} - ${fullEvent.status}`);

      // Send notifications for critical events
      if (fullEvent.type === 'backup' || fullEvent.type === 'release' || fullEvent.type === 'restore') {
        const type: 'success' | 'failure' | 'info' = 
          fullEvent.status === 'success' ? 'success' : 
          fullEvent.status === 'failure' ? 'failure' : 'info';

        await notificationManager.send({
          title: `${fullEvent.action} - ${fullEvent.status.toUpperCase()}`,
          message: fullEvent.details,
          type,
          appId: fullEvent.appId
        });
      }
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async getLogs(): Promise<AuditEvent[]> {
    try {
      return await fs.readJson(this.logPath);
    } catch {
      return [];
    }
  }

  async clearLogs(type?: string) {
    try {
      if (!type || type === 'all') {
        await fs.writeJson(this.logPath, [], { spaces: 2 });
      } else {
        const logs = await fs.readJson(this.logPath);
        const filtered = logs.filter((l: AuditEvent) => l.type !== type);
        await fs.writeJson(this.logPath, filtered, { spaces: 2 });
      }
    } catch (err) {
      console.error('Failed to clear audit logs:', err);
    }
  }

  async deleteLog(id: string) {
    try {
      const logs = await fs.readJson(this.logPath);
      const filtered = logs.filter((l: AuditEvent) => l.id !== id);
      await fs.writeJson(this.logPath, filtered, { spaces: 2 });
    } catch (err) {
      console.error('Failed to delete audit log:', err);
    }
  }
}

export const auditLogger = new AuditLogger();
