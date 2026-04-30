import fs from 'fs-extra';
import path from 'path';

export interface AppSettings {
  strictMode: boolean; // If true, block deploys if health is DOWN
  autoRetryBackups: boolean;
  retentionDays: number;
}

export class SettingsManager {
  private configPath: string;
  private settings: AppSettings = {
    strictMode: false,
    autoRetryBackups: true,
    retentionDays: 30
  };

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'global-settings.json');
    fs.ensureDirSync(path.dirname(this.configPath));
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.settings = { ...this.settings, ...fs.readJsonSync(this.configPath) };
      }
    } catch (err) {
      console.error('[SettingsManager] Failed to load settings:', err);
    }
  }

  async update(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    await fs.writeJson(this.configPath, this.settings, { spaces: 2 });
  }

  getSettings(): AppSettings {
    return this.settings;
  }
}

export const settingsManager = new SettingsManager();
