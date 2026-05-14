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

async function searchInsights() {
  const dbs = [
    '(default)',
    'persona-db-0',
    'prompttool-db-0',
    'suiteutils-db-0',
    'promptmaster-spa-db-0',
    'promptaccreditation-db-0'
  ];

  for (const dbId of dbs) {
    console.log(`--- Searching ${dbId} ---`);
    try {
      const db = getFirestore(adminApp, dbId);
      const collections = await db.listCollections();
      for (const col of collections) {
        if (col.id.toLowerCase().includes('insight') || col.id.toLowerCase().includes('memory')) {
           const snapshot = await col.get();
           console.log(`FOUND COLLECTION: ${col.id} with ${snapshot.size} documents in ${dbId}`);
        }
      }
    } catch (err: any) {
      console.warn(`Skip ${dbId}: ${err.message}`);
    }
  }
}

searchInsights().catch(console.error);
