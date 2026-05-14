import fs from 'fs-extra';
import path from 'path';

interface ModuleConfig {
  id: number;
  name: string;
  script: string;
  port: number;
  enabled: boolean;
  supportingPorts?: number[];
}

interface SuiteConfig {
  activeSession: string;
  modules: ModuleConfig[];
}

export class SuiteConfigManager {
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'suite.config.json');
  }

  private readConfig(): SuiteConfig {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('suite.config.json not found');
    }
    return fs.readJsonSync(this.configPath);
  }

  private writeConfig(config: SuiteConfig) {
    fs.writeJsonSync(this.configPath, config, { spaces: 2 });
  }

  public setModulesEnabled(scriptNames: string[], enabled: boolean) {
    try {
      const config = this.readConfig();
      let changed = false;

      scriptNames.forEach(scriptName => {
        const module = config.modules.find(m => m.script.startsWith(scriptName));
        if (module) {
          console.log(`[SuiteConfig] Setting ${module.name} (${scriptName}) enabled to: ${enabled}`);
          module.enabled = enabled;
          changed = true;
        }
      });

      if (changed) {
        this.writeConfig(config);
      }
    } catch (err) {
      console.error(`[SuiteConfig] Failed to update bulk config: ${err}`);
    }
  }

  public setModuleEnabled(scriptName: string, enabled: boolean) {
    try {
      const config = this.readConfig();
      const module = config.modules.find(m => m.script.startsWith(scriptName));
      
      if (module) {
        console.log(`[SuiteConfig] Setting ${module.name} (${scriptName}) enabled to: ${enabled}`);
        module.enabled = enabled;
        this.writeConfig(config);
      } else {
        console.warn(`[SuiteConfig] Module not found for script: ${scriptName}`);
      }
    } catch (err) {
      console.error(`[SuiteConfig] Failed to update config: ${err}`);
    }
  }

  public isModuleEnabled(scriptName: string): boolean {
    try {
      const config = this.readConfig();
      const module = config.modules.find(m => m.script.startsWith(scriptName));
      return module ? module.enabled : false;
    } catch (err) {
      return false;
    }
  }
}

export const suiteConfigManager = new SuiteConfigManager();
