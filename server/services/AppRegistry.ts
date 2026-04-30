import { workspaceManager, AppConfig } from './WorkspaceManager.js';

export type { AppConfig as AppRecord };

export class AppRegistry {
  getApps(workspaceId: string = 'stillwater-suite'): AppConfig[] {
    const ws = workspaceManager.getWorkspace(workspaceId);
    return ws?.apps || [];
  }

  getApp(appId: string, workspaceId: string = 'stillwater-suite'): AppConfig | undefined {
    return this.getApps(workspaceId).find(a => a.id === appId);
  }
}

export const appRegistry = new AppRegistry();

// For backward compatibility during migration
export const APPS_REGISTRY = appRegistry.getApps();
