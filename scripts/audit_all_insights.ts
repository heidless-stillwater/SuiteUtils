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

async function auditAll() {
  const dbs = [
    '(default)',
    'persona-db-0',
    'prompttool-db-0',
    'suiteutils-db-0',
    'promptmaster-db-0',
    'promptresources-db-0',
    'autovideo-db-0',
    'plantune-db-0',
    'promptaccreditation-db-0'
  ];

  for (const dbId of dbs) {
    console.log(`--- DB: ${dbId} ---`);
    try {
      const db = getFirestore(adminApp, dbId);
      const collections = await db.listCollections();
      for (const col of collections) {
        if (col.id === 'insights') {
          const snapshot = await col.get();
          console.log(`FOUND COLLECTION: insights with ${snapshot.size} documents in ${dbId}`);
          if (snapshot.size > 0 && dbId !== 'persona-db-0') {
             console.log(`>>> DATA DISCOVERED IN ${dbId}. REQUIRING MIGRATION.`);
          }
        } else {
          // console.log(`Collection: ${col.id}`);
        }
      }
    } catch (err: any) {
      console.warn(`Error on ${dbId}: ${err.message}`);
    }
  }
}

auditAll().catch(console.error);
