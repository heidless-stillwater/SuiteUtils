const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = '/home/heidless/projects';
const TARGET_API_KEY = 'AIzaSyCiaUg3a8aw72KarxZCUGUMdfaCK7Y-3tk';
const APP_ID_GROUP_1 = '1:162911733499:web:68e7bfc3e0b00bc8a3125e';
const APP_ID_GROUP_2 = '1:162911733499:web:2b4bec81ee626a4ea3125e';

const appGroups = {
  group1: ['PromptTool', 'Persona', 'SuiteUtils', 'PromptMasterSPA', 'URLShortener'],
  group2: ['ag-video-system', 'PromptResources', 'PromptAccreditation', 'PlanTune', 'TokenMarket']
};

const appEnvMapping = {
  'ag-video-system': '.env.local',
  'PromptTool': '.env.local',
  'PromptResources': '.env.local',
  'PromptMasterSPA': '.env.local',
  'PromptAccreditation': '.env.local',
  'PlanTune': '.env.local',
  'SuiteUtils': '.env',
  'Persona': '.env.local',
  'URLShortener': '.env.local',
  'TokenMarket': '.env'
};

console.log("📝 Injecting target credentials into environment files...");

for (const [appName, envFile] of Object.entries(appEnvMapping)) {
  const appDir = path.join(PROJECTS_DIR, appName);
  if (!fs.existsSync(appDir)) continue;

  const sov02Path = path.join(appDir, `${envFile}.sovereign-02`);
  const activePath = path.join(appDir, envFile);

  if (!fs.existsSync(sov02Path)) {
    console.log(`⚠️  Warning: ${appName} template file not found.`);
    continue;
  }

  let content = fs.readFileSync(sov02Path, 'utf8');

  // Determine App ID based on Group mapping
  const appId = appGroups.group1.includes(appName) ? APP_ID_GROUP_1 : APP_ID_GROUP_2;

  // Replace API Key and App ID placeholders
  content = content.replace(/PLACEHOLDER_INSERT_TARGET_API_KEY/g, TARGET_API_KEY);
  content = content.replace(/PLACEHOLDER_INSERT_TARGET_APP_ID/g, appId);

  // Write updated target file and copy to active configuration
  fs.writeFileSync(sov02Path, content, 'utf8');
  fs.writeFileSync(activePath, content, 'utf8');
  console.log(`   ✅ Patched and activated config for: ${appName}`);
}

console.log("\n✨ Credentials injected successfully!");
