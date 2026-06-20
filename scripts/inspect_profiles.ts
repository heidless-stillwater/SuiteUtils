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

async function inspectProfiles() {
  const db = getFirestore(adminApp, 'persona-db-0');
  const snapshot = await db.collection('config').get();
  
  console.log(`Inspecting ${snapshot.size} profiles...`);
  snapshot.docs.forEach(doc => {
    console.log(`--- Profile: ${doc.id} ---`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

inspectProfiles().catch(console.error);
