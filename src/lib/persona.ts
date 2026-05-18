/**
 * PERSONA LINK
 * The bridge between SuiteUtils and the Persona Intelligence Hub.
 */

const BRIDGE_URL = 'http://localhost:3006';

export interface Principle {
  content: string;
  updatedAt: string;
}

export interface PersonaProfile {
  name: string;
  expertise: string;
  principles: (string | Principle)[];
  skills: string[];
  archetype: string;
  version: string;
}

export const personaLink = {
  /**
   * Fetches the active persona profile from the local bridge.
   */
  async getProfile(): Promise<PersonaProfile | null> {
    try {
      const res = await fetch(`${BRIDGE_URL}/profile`);
      if (res.ok) return await res.json();
      return null;
    } catch (err) {
      console.warn('[PersonaLink] Failed to fetch profile:', err);
      return null;
    }
  },

  /**
   * Sends an administrative observation to the Persona Hub.
   * This allows the Hub to "learn" from your work in SuiteUtils.
   */
  async reportObservation(type: 'db' | 'sysadmin' | 'deployment', data: any) {
    try {
      await fetch(`${BRIDGE_URL}/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[PersonaLink] Failed to report observation:', err);
    }
  },

  /**
   * Reports a meaningful DB insight (e.g. migration success, schema optimization).
   */
  async reportDBInsight(content: string, insightType: 'technical' | 'architectural' = 'technical') {
    try {
      await fetch(`${BRIDGE_URL}/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candidate_insight',
          content,
          insightType,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[PersonaLink] Failed to report DB insight:', err);
    }
  }
};
