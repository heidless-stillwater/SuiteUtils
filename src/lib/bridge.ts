
const BRIDGE_URL = 'http://localhost:3006';

export interface SovereignPersona {
  name: string;
  expertise: string;
  communicationStyle: string;
  principles: string[];
  skills: string[];
  archetype?: string;
  lastSyncAt?: string;
  version?: string;
}

export const bridge = {
  async getProfile(): Promise<SovereignPersona | null> {
    try {
      const res = await fetch(`${BRIDGE_URL}/profile`);
      if (!res.ok) return null;
      return res.json();
    } catch (err) {
      console.error('[Bridge Client] Failed to fetch profile:', err);
      return null;
    }
  },

  async saveProfile(profile: SovereignPersona): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      return res.ok;
    } catch (err) {
      console.error('[Bridge Client] Failed to save profile:', err);
      return false;
    }
  },

  async getObservations(): Promise<any[]> {
    try {
      const res = await fetch(`${BRIDGE_URL}/observations`);
      if (!res.ok) throw new Error(`Bridge responded with ${res.status}`);
      return res.json();
    } catch (err) {
      console.error('[Bridge Client] Observations fetch failed:', err);
      throw err;
    }
  },

  async addObservation(type: string, data: any): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  },

  async deleteObservation(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/observations/${id}/delete`, {
        method: 'POST'
      });
      return res.ok;
    } catch (err) {
      console.error('[Bridge Client] Failed to delete observation:', err);
      return false;
    }
  },

  async getArchetypes(): Promise<string[]> {
    try {
      const res = await fetch(`${BRIDGE_URL}/archetypes`);
      if (!res.ok) return ['Architect', 'Hacker', 'Creative', 'Guardian', 'Researcher'];
      return res.json();
    } catch (err) {
      return ['Architect', 'Hacker', 'Creative', 'Guardian', 'Researcher'];
    }
  },

  async addArchetype(name: string): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/archetypes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  },

  async deleteArchetype(name: string): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/archetypes/${name}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  },
  
  async promoteInsight(content: string): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      return res.ok;
    } catch (err) {
      console.error('[Bridge Client] Failed to promote insight:', err);
      return false;
    }
  },

  async getMemory(): Promise<any[]> {
    try {
      const res = await fetch(`${BRIDGE_URL}/memory`);
      if (!res.ok) return [];
      return res.json();
    } catch (err) {
      return [];
    }
  },

  async addEpisode(type: string, content: string, metadata: any = {}): Promise<boolean> {
    try {
      const res = await fetch(`${BRIDGE_URL}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, metadata })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  },

  async sendCommand(text: string): Promise<any> {
    try {
      const res = await fetch(`${BRIDGE_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'ui' })
      });
      if (!res.ok) throw new Error(`Bridge error: ${res.status}`);
      return res.json();
    } catch (err) {
      console.error('[Bridge Client] Command failed:', err);
      return { success: false, error: (err as Error).message };
    }
  }
};
