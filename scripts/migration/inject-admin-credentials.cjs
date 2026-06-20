const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = '/home/heidless/projects';
const SA_KEY_PATH = path.join(PROJECTS_DIR, 'SuiteUtils/suite-admin-sovereign-02.json');

if (!fs.existsSync(SA_KEY_PATH)) {
  console.error(`❌ Error: Service account key not found at ${SA_KEY_PATH}`);
  process.exit(1);
}

console.log(`🔑 Reading credentials from ${SA_KEY_PATH}...`);
const sa = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf8'));
const clientEmail = sa.client_email;
const privateKey = sa.private_key;

const targets = [
  { appName: 'PromptAccreditation', envFile: '.env.local', keys: { FIREBASE_ADMIN_CLIENT_EMAIL: 'email', FIREBASE_ADMIN_PRIVATE_KEY: 'key' } },
  { appName: 'PromptAccreditation', envFile: '.env.local.sovereign-02', keys: { FIREBASE_ADMIN_CLIENT_EMAIL: 'email', FIREBASE_ADMIN_PRIVATE_KEY: 'key' } },
  { appName: 'PromptResources', envFile: '.env.local', keys: { FIREBASE_ADMIN_CLIENT_EMAIL: 'email', FIREBASE_ADMIN_PRIVATE_KEY: 'key' } },
  { appName: 'PromptResources', envFile: '.env.local.sovereign-02', keys: { FIREBASE_ADMIN_CLIENT_EMAIL: 'email', FIREBASE_ADMIN_PRIVATE_KEY: 'key' } },
  { appName: 'PromptTool', envFile: '.env.local', keys: { FIREBASE_CLIENT_EMAIL: 'email', FIREBASE_PRIVATE_KEY: 'key' } },
  { appName: 'PromptTool', envFile: '.env.local.sovereign-02', keys: { FIREBASE_CLIENT_EMAIL: 'email', FIREBASE_PRIVATE_KEY: 'key' } },
  { appName: 'PlanTune', envFile: '.env.local', keys: { FIREBASE_CLIENT_EMAIL: 'email', FIREBASE_PRIVATE_KEY: 'key' } },
  { appName: 'PlanTune', envFile: '.env.local.sovereign-02', keys: { FIREBASE_CLIENT_EMAIL: 'email', FIREBASE_PRIVATE_KEY: 'key' } },
  { appName: 'URLShortener', envFile: '.env.local', keys: { FIREBASE_CLIENT_EMAIL: 'email', FIREBASE_PRIVATE_KEY: 'key' } },
  { appName: 'URLShortener', envFile: '.env.local.sovereign-02', keys: { FIREBASE_CLIENT_EMAIL: 'email', FIREBASE_PRIVATE_KEY: 'key' } },
  { appName: 'ag-video-system', envFile: '.env.local', keys: { SERVICE_CLIENT_EMAIL: 'email', SERVICE_PRIVATE_KEY: 'key', ACC_CLIENT_EMAIL: 'email', ACC_PRIVATE_KEY: 'key' } },
  { appName: 'ag-video-system', envFile: '.env.local.sovereign-02', keys: { SERVICE_CLIENT_EMAIL: 'email', SERVICE_PRIVATE_KEY: 'key', ACC_CLIENT_EMAIL: 'email', ACC_PRIVATE_KEY: 'key' } }
];

console.log("📝 Injecting credentials...");

const escapedPrivateKey = privateKey.replace(/\n/g, '\\n');

for (const target of targets) {
  const filePath = path.join(PROJECTS_DIR, target.appName, target.envFile);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found, skipping: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  for (const [keyName, valueType] of Object.entries(target.keys)) {
    const value = valueType === 'email' ? clientEmail : `"${escapedPrivateKey}"`;
    const regex = new RegExp(`${keyName}=.*`, 'g');
    if (content.match(regex)) {
      content = content.replace(regex, `${keyName}=${value}`);
    } else {
      content += `\n${keyName}=${value}`;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   ✅ Successfully updated credentials in ${filePath}`);
}

console.log("✨ Done injecting credentials!");
