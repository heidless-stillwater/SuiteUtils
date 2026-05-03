import fs from 'fs-extra';
import path from 'path';

export interface AppConfig {
  id: string;
  name: string;
  dbId: string;
  projectPath: string;
  hostingTarget?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerEmail?: string;
  apps: AppConfig[];
  createdAt: string;
  gcpProjectId?: string;
}

export class WorkspaceManager {
  private configPath: string;
  private workspaces: Map<string, Workspace> = new Map();

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'workspaces.json');
    fs.ensureDirSync(path.dirname(this.configPath));
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readJsonSync(this.configPath);
        data.forEach((w: Workspace) => this.workspaces.set(w.id, w));
      } else {
        // Initialize with default Stillwater Suite if empty
        const defaultWorkspace: Workspace = {
          id: 'stillwater-suite',
          name: 'Stillwater Suite',
          description: 'Production Hub for Stillwater Core Apps',
          createdAt: new Date().toISOString(),
          apps: [
            { id: 'ag-video-system', name: 'Video System', dbId: 'autovideo-db-0', projectPath: '~/projects/ag-video-system', hostingTarget: 'videosystem-v0' },
            { id: 'prompttool', name: 'PromptTool', dbId: 'prompttool-db-0', projectPath: '~/projects/PromptTool', hostingTarget: 'prompttool-v0' },
            { id: 'promptresources', name: 'PromptResources', dbId: 'promptresources-db-0', projectPath: '~/projects/PromptResources', hostingTarget: 'promptresources-v0' },
            { id: 'promptmasterspa', name: 'PromptMaster v1', dbId: 'promptmaster-spa-db-0', projectPath: '~/projects/PromptMasterSPA', hostingTarget: 'promptmaster-v1' },
            { id: 'promptaccreditation', name: 'PromptAccreditation', dbId: 'promptaccreditation-db-0', projectPath: '~/projects/PromptAccreditation', hostingTarget: 'promptaccreditation-v0' },
            { id: 'plantune', name: 'PlanTune', dbId: 'plantune-db-0', projectPath: '~/projects/PlanTune', hostingTarget: 'plantune-v0' },
            { id: 'suiteutils', name: 'SuiteUtils', dbId: 'suiteutils-db-0', projectPath: '~/projects/SuiteUtils', hostingTarget: 'suiteutils-v0' }
          ]
        };
        this.workspaces.set(defaultWorkspace.id, defaultWorkspace);
        this.save();
      }
    } catch (err) {
      console.error('[WorkspaceManager] Failed to load workspaces:', err);
    }
  }

  private async save() {
    await fs.writeJson(this.configPath, Array.from(this.workspaces.values()), { spaces: 2 });
  }

  getWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  getWorkspace(id: string): Workspace | undefined {
    this.load(); // Always reload to ensure sync with manual file edits
    let ws = this.workspaces.get(id);
    
    // Self-healing: If unknown ID, provision with default Stillwater apps
    if (!ws) {
      console.log(`[WorkspaceManager] Auto-provisioning unknown workspace: ${id}`);
      ws = {
        id,
        name: 'Stillwater Suite',
        description: 'Auto-provisioned Production Hub',
        createdAt: new Date().toISOString(),
        apps: [
          { id: 'ag-video-system', name: 'Video System', dbId: 'autovideo-db-0', projectPath: '~/projects/ag-video-system', hostingTarget: 'videosystem-v0' },
          { id: 'prompttool', name: 'PromptTool', dbId: 'prompttool-db-0', projectPath: '~/projects/PromptTool', hostingTarget: 'heidless-prompt-tool' },
          { id: 'promptresources', name: 'PromptResources', dbId: 'promptresources-db-0', projectPath: '~/projects/PromptResources', hostingTarget: 'heidless-prompt-resources' },
          { id: 'promptmasterspa', name: 'PromptMaster v1', dbId: 'promptmaster-spa-db-0', projectPath: '~/projects/PromptMasterSPA', hostingTarget: 'heidless-prompt-master' },
          { id: 'promptaccreditation', name: 'PromptAccreditation', dbId: 'promptaccreditation-db-0', projectPath: '~/projects/PromptAccreditation', hostingTarget: 'heidless-prompt-accreditation' },
          { id: 'plantune', name: 'PlanTune', dbId: 'plantune-db-0', projectPath: '~/projects/PlanTune', hostingTarget: 'heidless-plan-tune' },
          { id: 'suiteutils', name: 'SuiteUtils', dbId: 'suiteutils-db-0', projectPath: '~/projects/SuiteUtils', hostingTarget: 'suite-utils' }
        ]
      };
      this.workspaces.set(id, ws);
      this.save();
    }
    
    return ws;
  }

  async createWorkspace(workspace: Omit<Workspace, 'createdAt'>) {
    const newWorkspace: Workspace = {
      ...workspace,
      createdAt: new Date().toISOString()
    };
    this.workspaces.set(newWorkspace.id, newWorkspace);
    await this.save();
    return newWorkspace;
  }

  async updateWorkspace(id: string, update: Partial<Workspace>) {
    const existing = this.workspaces.get(id);
    if (!existing) throw new Error(`Workspace ${id} not found`);
    const updated = { ...existing, ...update };
    this.workspaces.set(id, updated);
    await this.save();
    return updated;
  }
}

export const workspaceManager = new WorkspaceManager();
