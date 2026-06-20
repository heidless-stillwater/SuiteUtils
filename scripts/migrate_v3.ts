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

async function migrate() {
  const targetDb = getFirestore(adminApp, 'persona-db-0');
  
  const sourceDatabases = [
    'prompttool-db-0',
    'suiteutils-db-0',
    'promptmaster-spa-db-0',
    'plantune-db-0'
  ];

  for (const sourceId of sourceDatabases) {
    console.log(`--- Scanning ${sourceId} ---`);
    try {
      const sourceDb = getFirestore(adminApp, sourceId);
      const snapshot = await sourceDb.collection('insights').get();
      console.log(`Found ${snapshot.size} insights in ${sourceId}.`);

      if (snapshot.size > 0) {
        for (const doc of snapshot.docs) {
          await targetDb.collection('insights').doc(doc.id).set(doc.data());
          console.log(`Migrated [${sourceId}] -> ${doc.id}`);
        }
      }
    } catch (err: any) {
      console.warn(`Could not access ${sourceId}: ${err.message}`);
    }
  }
  console.log('Migration sweep complete.');
}

migrate().catch(console.error);
