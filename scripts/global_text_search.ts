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

async function globalTextSearch(searchText: string) {
  const dbs = [
    '(default)',
    'persona-db-0',
    'prompttool-db-0',
    'suiteutils-db-0',
    'promptmaster-spa-db-0',
    'promptaccreditation-db-0',
    'autovideo-db-0',
    'plantune-db-0'
  ];

  for (const dbId of dbs) {
    console.log(`--- Searching ${dbId} ---`);
    try {
      const db = getFirestore(adminApp, dbId);
      const collections = await db.listCollections();
      for (const col of collections) {
         const snapshot = await col.get();
         for (const doc of snapshot.docs) {
           const dataStr = JSON.stringify(doc.data()).toLowerCase();
           if (dataStr.includes(searchText.toLowerCase())) {
             console.log(`MATCH FOUND! DB: ${dbId}, Collection: ${col.id}, Doc: ${doc.id}`);
           }
         }
      }
    } catch (err: any) {
      console.warn(`Skip ${dbId}: ${err.message}`);
    }
  }
}

globalTextSearch('(default) is never used').catch(console.error);
