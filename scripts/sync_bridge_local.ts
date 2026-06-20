import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import os from 'os';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminApp = admin.app();
const db = getFirestore(adminApp, 'persona-db-0');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'persona');
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

async function syncLocal() {
  // Sync the currently active archetype (Architect) to the main profile.json for immediate UI update
  const architectDoc = await db.collection('config').doc('persona_architect').get();
  if (architectDoc.exists) {
    const data = architectDoc.data();
    fs.writeFileSync(path.join(CONFIG_DIR, 'profile.json'), JSON.stringify(data, null, 2));
    console.log('Synced persona_architect to local profile.json');
  }

  // Also sync archetypes.json list
  const archetypes = ['Architect', 'Hacker', 'Creative', 'Guardian', 'Researcher'];
  fs.writeFileSync(path.join(CONFIG_DIR, 'archetypes.json'), JSON.stringify(archetypes, null, 2));
  console.log('Synced archetypes list locally.');
}

syncLocal().catch(console.error);
