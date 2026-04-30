import { appRegistry } from './AppRegistry.js';

export interface HealthStatus {
  appId: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  lastChecked: string;
  responseTime?: number;
  error?: string;
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
    // For local dev, we map known ports. In prod, this would be an actual URL.
    let url = '';
    if (appId === 'SuiteUtils') {
      url = 'http://localhost:5181/api/health/ping'; // Self-check endpoint
    } else {
      // Placeholder: In a real multi-tenant app, these would be in the DB
      // For now, we use a port mapping convention for the Stillwater Suite
      const portMap: Record<string, number> = {
        'ag-video-system': 3001,
        'prompttool': 3002,
        'promptresources': 3003,
        'promptmasterspa': 3004,
        'promptaccreditation': 3005,
        'plantune': 3006,
        'suiteutils': 5181
      };
      const port = portMap[appId] || 3000;
      url = `http://localhost:${port}/health`;
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      const status: HealthStatus = {
        appId,
        status: res.ok ? 'UP' : 'DEGRADED',
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - start
      };
      this.statusMap.set(appId, status);
      return status;

    } catch (err: any) {
      const status: HealthStatus = {
        appId,
        status: 'DOWN',
        lastChecked: new Date().toISOString(),
        error: err.name === 'AbortError' ? 'Timeout' : err.message
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
