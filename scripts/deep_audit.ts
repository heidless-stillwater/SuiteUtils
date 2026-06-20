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

async function deepAudit() {
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
        const snapshot = await col.get();
        console.log(`Collection: ${col.id} (${snapshot.size} docs)`);
        if (snapshot.size > 0) {
           // Search first 5 docs for the text
           const limitDocs = snapshot.docs.slice(0, 5);
           for (const doc of limitDocs) {
             if (JSON.stringify(doc.data()).toLowerCase().includes('default')) {
               console.log(`>>> POSSIBLE MATCH in ${dbId}/${col.id}/${doc.id}`);
             }
           }
        }
      }
    } catch (err: any) {
      // console.warn(`Error on ${dbId}: ${err.message}`);
    }
  }
}

deepAudit().catch(console.error);
