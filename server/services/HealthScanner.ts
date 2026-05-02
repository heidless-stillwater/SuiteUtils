import { appRegistry } from './AppRegistry.js';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export interface HealthStatus {
  appId: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  lastChecked: string;
  responseTime?: number;
  error?: string;
  appVersion?: string;
}

export class HealthScanner {
  private statusMap: Map<string, HealthStatus> = new Map();

  async scanAll(workspaceId?: string): Promise<HealthStatus[]> {
    const apps = appRegistry.getApps(workspaceId);
    const results = await Promise.all(apps.map(app => this.checkApp(app.id, workspaceId)));
    return results;
  }

  async checkApp(appId: string, workspaceId?: string): Promise<HealthStatus> {
    const app = appRegistry.getApp(appId, workspaceId);
    if (!app) return { appId, status: 'UNKNOWN', lastChecked: new Date().toISOString() };

    // Determine the health URL
    const isProd = process.env.NODE_ENV === 'production';
    let url = '';

    if (appId.toLowerCase() === 'suiteutils') {
      url = isProd 
        ? 'https://suite-utils.web.app/api/health/ping'
        : 'http://localhost:5181/api/health/ping';
    } else {
      // Current Real Port Map (Dev)
      const portMap: Record<string, number> = {
        'ag-video-system': 3000,
        'prompttool': 3001,
        'promptresources': 3002,
        'promptmasterspa': 5173,
        'promptaccreditation': 3003,
        'plantune': 3004
      };

      if (app.hostingTarget) {
        url = `https://${app.hostingTarget}.web.app/`;
      } else {
        const port = portMap[appId] || 3000;
        url = `http://localhost:${port}/`;
      }
    }

    const start = Date.now();
    let appVersion = 'unknown';
    // Try to read local package.json version
    try {
      let resolvedPath = app.projectPath;
      if (resolvedPath.startsWith('~/')) {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(2));
      }

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
    } catch (e) {
      // Quietly fail if version cannot be read
    }

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      const status: HealthStatus = {
        appId,
        status: res.ok ? 'UP' : 'DEGRADED',
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - start,
        appVersion
      };
      this.statusMap.set(appId, status);
      return status;

    } catch (err: any) {
      const status: HealthStatus = {
        appId,
        status: 'DOWN',
        lastChecked: new Date().toISOString(),
        error: err.name === 'AbortError' ? 'Timeout' : err.message,
        appVersion
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
