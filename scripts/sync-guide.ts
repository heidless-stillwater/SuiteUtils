import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(import.meta.dirname, '../config/guide.config.json');
const FRONTEND_TARGET = path.join(import.meta.dirname, '../../Persona/src/components/guide-data.json');
const BACKEND_TARGET = path.join(import.meta.dirname, '../../Persona/bridge/commands/guide-data.json');

function main() {
  console.log('🛰️ Sovereign Guide Sync Sequence Initiated...');
  console.log(`Reading source config from: ${CONFIG_PATH}`);

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ ERROR: Source configuration not found at ${CONFIG_PATH}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(rawData);

    // Schema Validation Check
    if (!config.commands || typeof config.commands !== 'object') {
      throw new Error("Missing or invalid 'commands' registry key.");
    }
    if (!config.categories || !Array.isArray(config.categories)) {
      throw new Error("Missing or invalid 'categories' key.");
    }

    const commandKeys = Object.keys(config.commands);
    console.log(`✅ Config parsed successfully. Loaded ${commandKeys.length} commands.`);

    // 1. Write to Frontend target
    const frontendDir = path.dirname(FRONTEND_TARGET);
    if (!fs.existsSync(frontendDir)) {
      fs.mkdirSync(frontendDir, { recursive: true });
    }
    fs.writeFileSync(FRONTEND_TARGET, JSON.stringify(config, null, 2), 'utf8');
    console.log(`✅ Wrote frontend guide data: ${FRONTEND_TARGET}`);

    // 2. Write to Backend target
    const backendDir = path.dirname(BACKEND_TARGET);
    if (!fs.existsSync(backendDir)) {
      fs.mkdirSync(backendDir, { recursive: true });
    }
    fs.writeFileSync(BACKEND_TARGET, JSON.stringify(config, null, 2), 'utf8');
    console.log(`✅ Wrote backend guide data: ${BACKEND_TARGET}`);

    console.log('🛰️ Sovereign Guide Sync Complete.');
  } catch (error: any) {
    console.error('❌ ERROR: Failed to synchronize guide:', error.message);
    process.exit(1);
  }
}

main();
