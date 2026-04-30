import { workspaceManager } from './WorkspaceManager.js';
import { RollbackManager } from './RollbackManager.js';
import { auditLogger } from './AuditLogger.js';
import { IStorageProvider } from './IStorageProvider.js';

export interface MigrationMapping {
  sourceAppId: string;
  targetAppId: string;
  status: 'ready' | 'missing-target' | 'schema-mismatch';
}

export class MigrationManager {
  private rollbackManager: RollbackManager;

  constructor(storageProvider: IStorageProvider) {
    this.rollbackManager = new RollbackManager(storageProvider);
  }

  async analyzeMigration(sourceBackupPath: string, targetWorkspaceId: string): Promise<MigrationMapping[]> {
    const targetWorkspace = workspaceManager.getWorkspace(targetWorkspaceId);
    if (!targetWorkspace) throw new Error(`Target workspace ${targetWorkspaceId} not found`);

    // In a real implementation, we'd peek into the ZIP metadata here.
    // For now, we assume the standard Stillwater app set.
    const sourceApps = [
      'ag-video-system', 'PromptTool', 'PromptResources', 
      'PromptMasterSPA', 'PromptAccreditation', 'PlanTune', 'SuiteUtils'
    ];

    return sourceApps.map(appId => {
      const targetApp = targetWorkspace.apps.find(a => a.id === appId);
      return {
        sourceAppId: appId,
        targetAppId: appId,
        status: targetApp ? 'ready' : 'missing-target'
      };
    });
  }

  async executeMigration(sourceBackupPath: string, targetWorkspaceId: string, onProgress?: any) {
    const targetWorkspace = workspaceManager.getWorkspace(targetWorkspaceId);
    if (!targetWorkspace) throw new Error(`Target workspace ${targetWorkspaceId} not found`);

    const appIds = targetWorkspace.apps.map(a => a.id);

    await auditLogger.log({
      type: 'backup',
      action: 'Execute Cross-Suite Migration',
      status: 'info',
      details: `Migrating backup ${sourceBackupPath} into workspace: ${targetWorkspace.name}`,
      appId: 'StillwaterSuite'
    });

    // Reuse RollbackManager but targeting the specific workspace's app registry
    return this.rollbackManager.performRollback({
      cloudPath: sourceBackupPath,
      appIds,
      includeStorage: true,
      workspaceId: targetWorkspaceId,
      onProgress
    });
  }
}
