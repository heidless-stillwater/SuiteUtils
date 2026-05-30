import { appRegistry } from './AppRegistry.js';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { suiteDb as firestore } from './FirebaseAdmin.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HealthStatus {
  appId: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  lastChecked: string;
  responseTime?: number;
  error?: string;
  appVersion?: string;
  pid?: number;
  port?: number;
}

export class HealthScanner {
  private statusMap: Map<string, HealthStatus> = new Map();
  private scanInProgress: boolean = false;
  private lastScanAt: number = 0;

  constructor() {
    // Start background heartbeat
    setInterval(() => this.backgroundScan(), 15000);
  }

  /**
   * Returns statuses for apps. Prioritizes the Persona link for instant ignition.
   */
  async scanAll(workspaceId: string = 'stillwater-suite'): Promise<HealthStatus[]> {
    const workspaceApps = appRegistry.getApps(workspaceId);
    const personaId = 'persona';
    
    // Auto-provision missing entries
    workspaceApps.forEach(app => {
      const id = app.id.toLowerCase();
      if (!this.statusMap.has(id)) {
        this.statusMap.set(id, { 
          appId: app.id, 
          status: 'UNKNOWN', 
          lastChecked: new Date().toISOString() 
        });
      }
    });

    // CRITICAL: If Persona is unknown, perform an immediate synchronous probe
    const currentPersona = this.statusMap.get(personaId);
    if (!currentPersona || currentPersona.status === 'UNKNOWN') {
      await this.checkApp(personaId, workspaceId);
    }

    // Trigger background scan for the rest if stale (>10s)
    if (Date.now() - this.lastScanAt > 10000 && !this.scanInProgress) {
      this.backgroundScan(workspaceId).catch(() => {});
    }

    const appIds = new Set(workspaceApps.map(a => a.id.toLowerCase()));
    return Array.from(this.statusMap.values()).filter(s => appIds.has(s.appId.toLowerCase()));
  }

  private async backgroundScan(workspaceId: string = 'stillwater-suite') {
    if (this.scanInProgress) return;
    this.scanInProgress = true;
    
    try {
      const apps = appRegistry.getApps(workspaceId);
      
      // Always prioritize Persona in the background queue
      const personaApp = apps.find(a => a.id.toLowerCase() === 'persona');
      if (personaApp) await this.checkApp(personaApp.id, workspaceId);

      // Run remaining checks in parallel
      const others = apps.filter(a => a.id.toLowerCase() !== 'persona');
      await Promise.all(others.map(app => 
        Promise.race([
          this.checkApp(app.id, workspaceId),
          new Promise<void>((resolve) => setTimeout(resolve, 10000))
        ])
      ));
      
      this.lastScanAt = Date.now();
    } catch (err: any) {
      console.error(`[HealthScanner] Heartbeat failed:`, err.message);
    } finally {
      this.scanInProgress = false;
    }
  }

  async checkApp(appId: string, workspaceId: string = 'stillwater-suite'): Promise<HealthStatus> {
    const start = Date.now();
    const id = appId.toLowerCase();
    let firestoreUrl = '';
    
    try {
      const suiteDoc = await Promise.race([
        firestore.collection('suites').doc(workspaceId).get(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      if (suiteDoc?.exists) {
        firestoreUrl = suiteDoc.data()?.apps?.[appId]?.environments?.production?.deployUrl || '';
      }
    } catch (e) {}

    const isProd = process.env.NODE_ENV === 'production';
    const portMap: Record<string, number> = {
      'ag-video-system': 3000,
      'prompttool': 3001,
      'promptresources': 3002,
      'promptmasterspa': 5173,
      'promptaccreditation': 3003,
      'plantune': 3004,
      'persona': 3005,
      'suiteutils': 5185,
      'urlshortener': 3006,
      'tokenmarket': 3007
    };

    const port = portMap[id];
    let url = firestoreUrl;
    if (!isProd && port) url = `http://127.0.0.1:${port}/api/health/ping`;

    // 2. SELF-CHECK: If we are checking suiteutils, we are definitely UP
    if (id === 'suiteutils') {
      const result: HealthStatus = {
        appId,
        status: 'UP',
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - start,
        pid: process.pid,
        port: port || Number(process.env.PORT) || 5185
      };
      this.statusMap.set(id, result);
      return result;
    }

    let pid: number | undefined;
    if (!isProd && port) {
      try {
        const { stdout } = await execAsync(`ss -lntp "sport = :${port}" 2>/dev/null`, { timeout: 1500 });
        const pidMatch = stdout.match(/pid=(\d+)/);
        if (pidMatch) {
          pid = parseInt(pidMatch[1]);
        } else {
          const { stdout: fuserOut } = await execAsync(`fuser ${port}/tcp 2>/dev/null`, { timeout: 1000 });
          if (fuserOut) pid = parseInt(fuserOut.trim().split(/\s+/)[0]);
        }
      } catch (e) {}
    }

    let finalOk = false;
    let lastError = '';
    if (url) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3000);
        let res = await fetch(url, { signal: controller.signal });
        
        // Fallback to root if specific ping endpoint fails
        if (!res.ok) {
          const rootUrl = url.split('/api/')[0];
          res = await fetch(rootUrl, { signal: controller.signal });
        }
        
        clearTimeout(tid);
        if (res.ok) finalOk = true;
        else lastError = `HTTP ${res.status}`;
      } catch (err: any) {
        lastError = err.name === 'AbortError' ? 'Timeout' : err.message;
      }
    }

    const status: 'UP' | 'DOWN' | 'DEGRADED' = (finalOk || pid) ? 'UP' : (lastError ? 'DEGRADED' : 'DOWN');
    
    const result: HealthStatus = {
      appId,
      status,
      lastChecked: new Date().toISOString(),
      responseTime: Date.now() - start,
      pid,
      port,
      error: !finalOk && pid ? 'Process active, but HTTP probe failed' : lastError || undefined
    };

    this.statusMap.set(id, result);
    return result;
  }

  getStatus(appId: string): HealthStatus | undefined {
    return this.statusMap.get(appId.toLowerCase());
  }
}

export const healthScanner = new HealthScanner();
