const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECTS_DIR = '/home/heidless/projects';
const TGT_PROJECT = 'stillwater-sovereign-02';

const repoConfigs = [
  { repo: 'PromptTool', database: 'prompttool-db-0' },
  { repo: 'Persona', database: 'persona-db-0' },
  { repo: 'ag-video-system', database: 'autovideo-db-0' },
  { repo: 'SuiteUtils', database: 'suiteutils-db-0' },
  { repo: 'PromptResources', database: 'promptresources-db-0' },
  { repo: 'PromptAccreditation', database: 'promptaccreditation-db-0' },
  { repo: 'PromptMasterSPA', database: 'promptmaster-spa-db-0' },
  { repo: 'PlanTune', database: 'plantune-db-0' }
];

console.log("🚀 Starting Multi-Database Firestore Index Deployment Workaround...");

for (const { repo, database } of repoConfigs) {
  const repoDir = path.join(PROJECTS_DIR, repo);
  const firebaseJsonPath = path.join(repoDir, 'firebase.json');
  
  if (!fs.existsSync(firebaseJsonPath)) {
    console.log(`⚠️  Skipping ${repo}: firebase.json not found`);
    continue;
  }
  
  console.log(`\n📂 Processing repository: ${repo} (Target Database: ${database})`);
  
  const originalContent = fs.readFileSync(firebaseJsonPath, 'utf8');
  let config;
  try {
    config = JSON.parse(originalContent);
  } catch (err) {
    console.error(`❌ Error parsing JSON in ${repo}:`, err.message);
    continue;
  }
  
  if (!config.firestore) {
    console.log(`ℹ️  No firestore configuration in ${repo}`);
    continue;
  }
  
  let targetEntry = null;
  if (Array.isArray(config.firestore)) {
    targetEntry = config.firestore.find(entry => entry.database === database);
  } else if (typeof config.firestore === 'object') {
    targetEntry = config.firestore;
  }
  
  if (!targetEntry || !targetEntry.indexes) {
    console.log(`ℹ️  No indexes configured for database ${database} in ${repo}`);
    continue;
  }
  
  const tempConfig = { ...config, firestore: targetEntry };
  fs.writeFileSync(firebaseJsonPath, JSON.stringify(tempConfig, null, 2), 'utf8');
  
  try {
    console.log(`   Deploying indexes to database '${database}'...`);
    execSync(`firebase deploy --only firestore:indexes --project ${TGT_PROJECT} --non-interactive`, {
      cwd: repoDir,
      stdio: 'inherit'
    });
    console.log(`   ✅ Deploy triggered successfully.`);
  } catch (err) {
    console.error(`   ❌ Deployment failed:`, err.message);
  } finally {
    fs.writeFileSync(firebaseJsonPath, originalContent, 'utf8');
    console.log(`   ♻️  Restored firebase.json`);
  }
}
console.log("\n✨ Workaround deployment phase complete!");
