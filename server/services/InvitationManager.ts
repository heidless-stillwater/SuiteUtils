import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Invitation {
  id: string;
  email: string;
  workspaceId: string;
  role: 'viewer' | 'operator' | 'admin';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

export class InvitationManager {
  private configPath: string;
  private invitations: Invitation[] = [];

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'invitations.json');
    fs.ensureDirSync(path.dirname(this.configPath));
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.invitations = fs.readJsonSync(this.configPath);
      }
    } catch (err) {
      console.error('[InvitationManager] Failed to load invitations:', err);
    }
  }

  private async save() {
    await fs.writeJson(this.configPath, this.invitations, { spaces: 2 });
  }

  async createInvitation(email: string, workspaceId: string, role: string, invitedBy: string) {
    const invitation: Invitation = {
      id: uuidv4(),
      email,
      workspaceId,
      role: role as any,
      invitedBy,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.invitations.push(invitation);
    await this.save();
    return invitation;
  }

  getInvitationsForWorkspace(workspaceId: string) {
    return this.invitations.filter(i => i.workspaceId === workspaceId);
  }

  async revokeInvitation(id: string) {
    this.invitations = this.invitations.filter(i => i.id !== id);
    await this.save();
  }
}

export const invitationManager = new InvitationManager();
