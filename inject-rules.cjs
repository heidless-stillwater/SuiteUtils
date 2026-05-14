const { initializeApp, cert } = require('firebase-admin/app');
const { getSecurityRules } = require('firebase-admin/security-rules');
const serviceAccount = require('./suite-admin-sovereign.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'stillwater-sovereign-01'
});

const rulesContent = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
`;

async function inject() {
  const securityRules = getSecurityRules(app);
  const databases = [
    'persona-db-0', 'prompttool-db-0', 'promptresources-db-0', 
    'promptmaster-spa-db-0', 'promptaccreditation-db-0', 
    'plantune-db-0', 'suiteutils-db-0', 'autovideo-db-0'
  ];

  console.log('--- Sovereign Rule Injection ---');
  // Create ruleset once
  const ruleset = await securityRules.createRuleset({
    files: [{ name: 'firestore.rules', content: rulesContent }]
  });
  
  for (const dbId of databases) {
    try {
      console.log('>>> Unlocking Corridors: ' + dbId);
      await securityRules.releaseFirestoreRuleset(ruleset, dbId);
      console.log('✅ ' + dbId + ' UNLOCKED.');
    } catch (err) {
      console.error('❌ ' + dbId + ' FAILED:', err.message);
    }
  }
}

inject().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
