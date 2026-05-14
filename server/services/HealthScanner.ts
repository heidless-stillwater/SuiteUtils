import { appRegistry } from './AppRegistry.js';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { suiteDb as firestore } from './FirebaseAdmin.js';

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

  async scanAll(workspaceId?: string): Promise<HealthStatus[]> {
    const apps = appRegistry.getApps(workspaceId);
    const results = await Promise.all(apps.map(app => this.checkApp(app.id, workspaceId)));
    return results;
  }

  async checkApp(appId: string, workspaceId: string = 'stillwater-suite'): Promise<HealthStatus> {
    // 1. Try to get the latest deployUrl and status from Firestore first
    let firestoreUrl = '';
    try {
      const suiteDoc = await firestore.collection('suites').doc(workspaceId).get();
      if (suiteDoc.exists) {
        const data = suiteDoc.data();
        const appData = data?.apps?.[appId];
        if (appData?.environments?.production?.deployUrl) {
          firestoreUrl = appData.environments.production.deployUrl;
        }
      }
    } catch (e) {
      console.warn(`[HealthScanner] Failed to fetch Firestore data for ${appId}:`, e);
    }

    const app = appRegistry.getApp(appId, workspaceId);
    if (!app && !firestoreUrl) return { appId, status: 'UNKNOWN', lastChecked: new Date().toISOString() };

    // Determine the health URL
    const isProd = process.env.NODE_ENV === 'production';
    let url = firestoreUrl; 

    // Current Real Port Map (Dev)
    const portMap: Record<string, number> = {
      'ag-video-system': 3000,
      'prompttool': 3001,
      'promptresources': 3002,
      'promptmasterspa': 5173,
      'promptaccreditation': 3003,
      'plantune': 3004,
      'persona': 3005
    };

    const port = portMap[appId] || 3000;

    if (!url) {
      if (appId.toLowerCase() === 'suiteutils') {
        const utilsPort = process.env.PORT || 5185;
        url = isProd 
          ? 'https://suite-utils.web.app/api/health/ping'
          : `http://localhost:${utilsPort}/api/health/ping`;
      } else {
        if (!isProd && portMap[appId]) {
          url = `http://localhost:${port}/`;
        } else if (app?.deployUrl) {
          url = app.deployUrl;
        } else if (app?.hostingTarget && !app?.deployMethod?.includes('cloud')) {
          url = `https://${app.hostingTarget}.web.app/`;
        } else if (appId === 'persona') {
          url = 'https://persona-789026577646.us-central1.run.app/';
        } else {
          url = `http://localhost:${port}/`;
        }
      }
    }

    // PID Discovery (Local only)
    let pid: number | undefined;
    if (!isProd) {
      try {
        const { execSync } = require('child_process');
        const pidResult = execSync(`fuser ${port}/tcp 2>/dev/null | awk '{print $1}'`, { encoding: 'utf8' }).trim();
        if (pidResult) pid = parseInt(pidResult);
      } catch (e) {
        // Silently fail PID discovery
      }
    }

    const start = Date.now();
    let appVersion = 'unknown';
    // Try to read local package.json version
    try {
      let resolvedPath = app?.projectPath || '';
      if (resolvedPath && resolvedPath.startsWith('~/')) {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(2));
      }

      if (resolvedPath) {
        // Check primary path, then fallback to relative lookup
        const pathsToTry = [
          path.join(resolvedPath, 'package.json'),
          path.resolve(process.cwd(), '..', appId, 'package.json'),
          path.resolve(process.cwd(), '..', path.basename(resolvedPath), 'package.json')
        ];

        for (const p of pathsToTry) {
          if (fs.existsSync(p)) {
            const pkg = fs.readJsonSync(p);
            appVersion = pkg.version || 'unknown';
            break;
          }
        }
      }
    } catch (e) {
      // Quietly fail if version cannot be read
    }

    // Multi-stage health probe
    const probeEndpoints = ['', 'api/health', 'api/debug', 'api/compliance/suite-status'];
    let lastRes: Response | null = null;
    let finalOk = false;

    for (const endpoint of probeEndpoints) {
      try {
        const probeUrl = url.endsWith('/') ? `${url}${endpoint}` : `${url}/${endpoint}`;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000); 

        const res = await fetch(probeUrl, { signal: controller.signal });
        clearTimeout(id);
        lastRes = res;

        if (res.ok) {
          finalOk = true;
          break; // Stop once we find a healthy signal
        }
      } catch (err) {
        // Continue to next probe
      }
    }


    if (finalOk) {
      const status: HealthStatus = {
        appId,
        status: 'UP',
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - start,
        appVersion,
        pid,
        port
      };
      this.statusMap.set(appId, status);
      return status;
    } else {
      const status: HealthStatus = {
        appId,
        status: lastRes ? 'DEGRADED' : 'DOWN',
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - start,
        error: lastRes ? `HTTP ${lastRes.status}` : 'No response from known endpoints',
        appVersion,
        pid,
        port
      };
      this.statusMap.set(appId, status);
      return status;
    }
  }

  getStatus(appId: string): HealthStatus | undefined {
    return this.statusMap.get(appId);
  }
}

export const healthScanner = new HealthScanner();
