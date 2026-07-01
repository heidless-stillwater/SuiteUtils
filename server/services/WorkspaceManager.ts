import fs from 'fs-extra';
import path from 'path';
import { adminApp } from './FirebaseAdmin.js';

export interface AppConfig {
  id: string;
  name: string;
  dbId: string;
  projectPath: string;
  hostingTarget?: string;
  deployMethod?: string;
  deployUrl?: string;
}

export interface DefaultSortConfig {
  type: 'name' | 'timestamp' | 'updated' | 'custom';
  direction: 'asc' | 'desc';
  appOrder?: string[];
  infraOrder?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerEmail?: string;
  apps: AppConfig[];
  infrastructure?: AppConfig[];
  createdAt: string;
  gcpProjectId?: string;
  defaultSort?: DefaultSortConfig;
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
            { id: 'ag-video-system', name: 'Video System', dbId: 'autovideo-db-0', projectPath: '~/projects/ag-video-system', hostingTarget: 'stillwater-video-system', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-video-system-02.web.app' },
            { id: 'prompttool', name: 'PromptTool', dbId: 'prompttool-db-0', projectPath: '~/projects/PromptTool', hostingTarget: 'prompttool-v0' },
            { id: 'promptresources', name: 'PromptResources', dbId: 'promptresources-db-0', projectPath: '~/projects/PromptResources', hostingTarget: 'promptresources-v0' },
            { id: 'promptmasterspa', name: 'PromptMaster v1', dbId: 'promptmaster-spa-db-0', projectPath: '~/projects/PromptMasterSPA', hostingTarget: 'stillwater-prompt-master', deployMethod: 'firebase', deployUrl: 'https://stillwater-prompt-master-02.web.app' },
            { id: 'promptaccreditation', name: 'PromptAccreditation', dbId: 'promptaccreditation-db-0', projectPath: '~/projects/PromptAccreditation', hostingTarget: 'stillwater-prompt-accreditation', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-prompt-accreditation-02.web.app' },
            { id: 'plantune', name: 'PlanTune', dbId: 'plantune-db-0', projectPath: '~/projects/PlanTune', hostingTarget: 'stillwater-plan-tune', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-plan-tune-02.web.app' },
            { id: 'suiteutils', name: 'SuiteUtils', dbId: 'suiteutils-db-0', projectPath: '~/projects/SuiteUtils', hostingTarget: 'suiteutils-v0' },
            { id: 'persona', name: 'persona v1.0', dbId: 'persona-db-0', projectPath: '~/projects/Persona', hostingTarget: 'stillwater-persona', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-persona-02.web.app' },
            { id: 'urlshortener', name: 'URLShortener v1.0', dbId: 'urlshortener-db-0', projectPath: '~/projects/URLShortener', hostingTarget: 'stillwater-url-shortener', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-url-shortener-02.web.app' },
            { id: 'tokenmarket', name: 'TokenMarket v1.0', dbId: 'tokenmarket-db-0', projectPath: '~/projects/TokenMarket', hostingTarget: 'stillwater-token-market', deployMethod: 'firebase', deployUrl: 'https://stillwater-token-market-02.web.app' },
            { id: 'inferencegateway', name: 'InferenceGateway v1.0', dbId: 'inferencegateway-db-0', projectPath: '~/projects/InferenceGateway', hostingTarget: 'stillwater-inference-gateway', deployMethod: 'firebase', deployUrl: 'http://localhost:3009' }
          ],
          infrastructure: [
            { id: 'suiteutils-api', name: 'SuiteUtils API', dbId: 'suiteutils-db-0', projectPath: '~/projects/SuiteUtils', hostingTarget: 'suite-utils' },
            { id: 'persona-bridge', name: 'Persona Bridge API', dbId: 'persona-db-0', projectPath: '~/projects/Persona', hostingTarget: 'stillwater-persona' }
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
    const list = Array.from(this.workspaces.values());
    return list.map(w => ({
      ...w,
      gcpProjectId: adminApp?.options?.projectId || w.gcpProjectId || 'stillwater-sovereign-02'
    }));
  }

  getWorkspace(id: string): Workspace | undefined {
    this.load(); // Always reload to ensure sync with manual file edits
    let ws = this.workspaces.get(id);
    
    // Self-healing: ONLY auto-provision if 'stillwater-suite' is missing. 
    // Otherwise, we get duplicate entries for every unique x-workspace-id header ever used.
    if (!ws && id === 'stillwater-suite') {
      console.log(`[WorkspaceManager] Provisioning missing primary workspace: ${id}`);
      ws = {
        id,
        name: 'Stillwater Suite',
        description: 'Primary Production Hub',
        createdAt: new Date().toISOString(),
        apps: [
          { id: 'ag-video-system', name: 'Video System', dbId: 'autovideo-db-0', projectPath: '~/projects/ag-video-system', hostingTarget: 'stillwater-video-system', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-video-system-02.web.app' },
          { id: 'prompttool', name: 'PromptTool', dbId: 'prompttool-db-0', projectPath: '~/projects/PromptTool', hostingTarget: 'stillwater-prompt-tool' },
          { id: 'promptresources', name: 'PromptResources', dbId: 'promptresources-db-0', projectPath: '~/projects/PromptResources', hostingTarget: 'stillwater-prompt-resources' },
          { id: 'promptmasterspa', name: 'PromptMaster v1', dbId: 'promptmaster-spa-db-0', projectPath: '~/projects/PromptMasterSPA', hostingTarget: 'stillwater-prompt-master', deployMethod: 'firebase', deployUrl: 'https://stillwater-prompt-master-02.web.app' },
          { id: 'promptaccreditation', name: 'PromptAccreditation', dbId: 'promptaccreditation-db-0', projectPath: '~/projects/PromptAccreditation', hostingTarget: 'stillwater-prompt-accreditation', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-prompt-accreditation-02.web.app' },
          { id: 'plantune', name: 'PlanTune', dbId: 'plantune-db-0', projectPath: '~/projects/PlanTune', hostingTarget: 'stillwater-plan-tune', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-plan-tune-02.web.app' },
          { id: 'suiteutils', name: 'SuiteUtils', dbId: 'suiteutils-db-0', projectPath: '~/projects/SuiteUtils', hostingTarget: 'suite-utils' },
          { id: 'persona', name: 'Persona', dbId: 'persona-db-0', projectPath: '~/projects/Persona', hostingTarget: 'stillwater-persona', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-persona-02.web.app' },
          { id: 'urlshortener', name: 'URLShortener v1.0', dbId: 'urlshortener-db-0', projectPath: '~/projects/URLShortener', hostingTarget: 'stillwater-url-shortener', deployMethod: 'cloud-build', deployUrl: 'https://stillwater-url-shortener-02.web.app' },
          { id: 'tokenmarket', name: 'TokenMarket v1.0', dbId: 'tokenmarket-db-0', projectPath: '~/projects/TokenMarket', hostingTarget: 'stillwater-token-market', deployMethod: 'firebase', deployUrl: 'https://stillwater-token-market-02.web.app' },
          { id: 'inferencegateway', name: 'InferenceGateway v1.0', dbId: 'inferencegateway-db-0', projectPath: '~/projects/InferenceGateway', hostingTarget: 'stillwater-inference-gateway', deployMethod: 'firebase', deployUrl: 'http://localhost:3009' }
        ],
        infrastructure: [
          { id: 'suiteutils-api', name: 'SuiteUtils API', dbId: 'suiteutils-db-0', projectPath: '~/projects/SuiteUtils', hostingTarget: 'suite-utils' },
          { id: 'persona-bridge', name: 'Persona Bridge API', dbId: 'persona-db-0', projectPath: '~/projects/Persona', hostingTarget: 'stillwater-persona' }
        ]
      };
      this.workspaces.set(id, ws);
      this.save();
    }
    
    if (ws) {
      return {
        ...ws,
        gcpProjectId: adminApp?.options?.projectId || ws.gcpProjectId || 'stillwater-sovereign-02'
      };
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

  async deleteWorkspace(id: string) {
    if (id === 'stillwater-suite') throw new Error('Cannot delete primary workspace');
    if (!this.workspaces.has(id)) throw new Error(`Workspace ${id} not found`);
    this.workspaces.delete(id);
    await this.save();
    return true;
  }
}

export const workspaceManager = new WorkspaceManager();
