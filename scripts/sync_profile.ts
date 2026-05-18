import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminApp = admin.app();

async function syncProfile() {
  console.log('🔄 Synchronizing local profile.json to persona-db-0 config...');
  const localProfilePath = '/home/heidless/.config/persona/profile.json';
  
  if (!fs.existsSync(localProfilePath)) {
    console.error('❌ Local profile.json not found!');
    process.exit(1);
  }

  const profile = JSON.parse(fs.readFileSync(localProfilePath, 'utf8'));
  const db = getFirestore(adminApp, 'persona-db-0');
  
  await db.collection('config').doc('persona_architect').set(profile, { merge: true });
  console.log('✅ Synchronized successfully with Firestore persona-db-0.');
}

syncProfile().catch(console.error);
