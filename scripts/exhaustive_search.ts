import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/heidless/projects/SuiteUtils/suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminApp = admin.app();

async function exhaustiveSearch() {
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
         console.log(`[COLLECTION_FOUND] DB: ${dbId}, COL: ${col.id}`);
         const snapshot = await col.get();
         for (const doc of snapshot.docs) {
           const data = doc.data();
           console.log(`[DOC_FOUND] DB: ${dbId}, COL: ${col.id}, DOC: ${doc.id}`);
           if (JSON.stringify(data).toLowerCase().includes('hacker')) {
              console.log(`[DATA_MATCH] DB: ${dbId}, COL: ${col.id}, DOC: ${doc.id}`);
              console.log(`DATA: ${JSON.stringify(data)}`);
           }
         }
      }
    } catch (err: any) {
      console.warn(`Error on ${dbId}: ${err.message}`);
    }
  }
}

exhaustiveSearch().catch(console.error);
