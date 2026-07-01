import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Configuration
const sourceKeyPath = './scratch/service-account-target.json'; // heidless-apps-2
const targetKeyPath = './suite-admin-sovereign.json';         // stillwater-sovereign-02

const sourceAccount = JSON.parse(fs.readFileSync(sourceKeyPath, 'utf8'));
const targetAccount = JSON.parse(fs.readFileSync(targetKeyPath, 'utf8'));

// Initialize Source App
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(sourceAccount)
}, 'source_coll');

// Initialize Target App
const targetApp = admin.initializeApp({
  credential: admin.credential.cert(targetAccount)
}, 'target_coll');

async function migrateCollections() {
  const sourceUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
  const targetUid = 'AHYxlW1bIibW4LZl3LoHPbGUUaz2';
  const dbId = 'prompttool-db-0';

  console.log(`🛰️ Starting Collection Migration from ${sourceAccount.project_id}...`);

  try {
    const sourceDb = getFirestore(sourceApp, dbId);
    const targetDb = getFirestore(targetApp, dbId);
    
    const sourceCollsRef = sourceDb.collection('users').doc(sourceUid).collection('collections');
    const snapshot = await sourceCollsRef.get();
    
    console.log(`📊 Found ${snapshot.size} collections to migrate.`);
    
    if (snapshot.size === 0) return;

    const targetCollsRef = targetDb.collection('users').doc(targetUid).collection('collections');
    const batch = targetDb.batch();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const migratedData = {
        ...data,
        userId: targetUid,
        migrationTimestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const newDocRef = targetCollsRef.doc(doc.id);
      batch.set(newDocRef, migratedData, { merge: true });
    });

    await batch.commit();
    console.log(`✅ Success! Collections migrated for ${targetUid}.`);

  } catch (error) {
    console.error('❌ Collection Migration Failed:', error);
  }
}

migrateCollections().catch(console.error);
