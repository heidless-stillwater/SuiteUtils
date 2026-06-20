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

async function listAll() {
  const dbs = [
    '(default)',
    'persona-db-0',
    'prompttool-db-0',
    'suiteutils-db-0'
  ];

  for (const dbId of dbs) {
    console.log(`--- DB: ${dbId} ---`);
    try {
      const db = getFirestore(adminApp, dbId);
      const collections = await db.listCollections();
      for (const col of collections) {
        const snapshot = await col.limit(1).get();
        console.log(`Collection: ${col.id} (${snapshot.size > 0 ? 'HAS DATA' : 'EMPTY'})`);
      }
    } catch (err: any) {
      console.warn(`Error on ${dbId}: ${err.message}`);
    }
  }
}

listAll().catch(console.error);
