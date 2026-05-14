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

async function inspectInsights() {
  const db = getFirestore(adminApp, 'persona-db-0');
  const snapshot = await db.collection('insights').get();
  
  console.log(`Inspecting ${snapshot.size} insights...`);
  snapshot.docs.forEach(doc => {
    console.log(`- [${doc.id}]:`, doc.data());
  });
}

inspectInsights().catch(console.error);
