import type { Theme } from './types';

// ============================================================
// THEME SERVICE — Runtime CSS Token Management
// ============================================================

/** Apply a theme's tokens to the document root */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  Object.entries(theme.tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/** Remove all custom theme overrides from document root */
export function resetTheme(): void {
  const root = document.documentElement;
  // Remove all custom properties set by themes
  const style = root.style;
  for (let i = style.length - 1; i >= 0; i--) {
    const prop = style[i];
    if (prop.startsWith('--')) {
      root.style.removeProperty(prop);
    }
  }
}

/** Default Stillwater Midnight theme definition */
export const STILLWATER_MIDNIGHT: Omit<Theme, 'createdAt' | 'updatedAt'> = {
  id: 'stillwater-midnight',
  name: 'Stillwater Midnight',
  tokens: {
    '--bg-primary': '#0f172a',
    '--bg-secondary': '#1e293b',
    '--bg-card': 'rgba(30, 41, 59, 0.7)',
    '--bg-input': '#334155',
    '--text-primary': '#f8fafc',
    '--text-secondary': '#cbd5e1',
    '--text-muted': '#94a3b8',
    '--accent-primary': '#0d9488',
    '--accent-secondary': '#10b981',
    '--brand-glow': 'rgba(13, 148, 136, 0.3)',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--danger': '#ef4444',
    '--info': '#06b6d4',
    '--border': 'rgba(148, 163, 184, 0.25)',
    '--stillwater-teal': '#14b8a6',
    '--founder-gold': '#fbbf24',
  },
};

/** Ocean Deep alternative theme */
export const OCEAN_DEEP: Omit<Theme, 'createdAt' | 'updatedAt'> = {
  id: 'ocean-deep',
  name: 'Ocean Deep',
  tokens: {
    '--bg-primary': '#0a1628',
    '--bg-secondary': '#162033',
    '--bg-card': 'rgba(22, 32, 51, 0.7)',
    '--bg-input': '#1e3050',
    '--text-primary': '#e8f4f8',
    '--text-secondary': '#a3c4d4',
    '--text-muted': '#6b8fa0',
    '--accent-primary': '#0891b2',
    '--accent-secondary': '#06b6d4',
    '--brand-glow': 'rgba(8, 145, 178, 0.3)',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--danger': '#ef4444',
    '--info': '#22d3ee',
    '--border': 'rgba(100, 160, 200, 0.2)',
    '--stillwater-teal': '#06b6d4',
    '--founder-gold': '#fbbf24',
  },
};

/** Ember Forge alternative theme */
export const EMBER_FORGE: Omit<Theme, 'createdAt' | 'updatedAt'> = {
  id: 'ember-forge',
  name: 'Ember Forge',
  tokens: {
    '--bg-primary': '#1a0f0a',
    '--bg-secondary': '#2a1a12',
    '--bg-card': 'rgba(42, 26, 18, 0.7)',
    '--bg-input': '#3d2518',
    '--text-primary': '#fef3e2',
    '--text-secondary': '#d4a574',
    '--text-muted': '#a07050',
    '--accent-primary': '#f97316',
    '--accent-secondary': '#fb923c',
    '--brand-glow': 'rgba(249, 115, 22, 0.3)',
    '--success': '#10b981',
    '--warning': '#fbbf24',
    '--danger': '#ef4444',
    '--info': '#06b6d4',
    '--border': 'rgba(200, 120, 60, 0.2)',
    '--stillwater-teal': '#f97316',
    '--founder-gold': '#fbbf24',
  },
};

/** All built-in themes */
export const BUILT_IN_THEMES = [STILLWATER_MIDNIGHT, OCEAN_DEEP, EMBER_FORGE];

/** Export theme as JSON for sharing */
export function exportTheme(theme: Theme): string {
  return JSON.stringify({ name: theme.name, tokens: theme.tokens }, null, 2);
}

/** Import theme from JSON string */
export function importTheme(json: string): Omit<Theme, 'id' | 'createdAt' | 'updatedAt'> | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed.name && parsed.tokens && typeof parsed.tokens === 'object') {
      return { name: parsed.name, tokens: parsed.tokens };
    }
    return null;
  } catch {
    return null;
  }
}

/** Get a subset of tokens by category for the editor */
export function getTokensByCategory(tokens: Record<string, string>) {
  const categories: Record<string, { key: string; value: string; label: string }[]> = {
    'Background': [],
    'Text': [],
    'Accent': [],
    'Status': [],
    'Glass & Border': [],
  };

  Object.entries(tokens).forEach(([key, value]) => {
    const label = key.replace(/^--/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    if (key.includes('bg-') || key.includes('background')) {
      categories['Background'].push({ key, value, label });
    } else if (key.includes('text-') || key.includes('foreground')) {
      categories['Text'].push({ key, value, label });
    } else if (key.includes('accent') || key.includes('primary') || key.includes('stillwater') || key.includes('founder') || key.includes('brand')) {
      categories['Accent'].push({ key, value, label });
    } else if (key.includes('success') || key.includes('warning') || key.includes('danger') || key.includes('info')) {
      categories['Status'].push({ key, value, label });
    } else {
      categories['Glass & Border'].push({ key, value, label });
    }
  });

  return categories;
}
