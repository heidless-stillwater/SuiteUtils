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
}, 'source');

// Initialize Target App
const targetApp = admin.initializeApp({
  credential: admin.credential.cert(targetAccount)
}, 'target');

async function migrateFullData() {
  const sourceUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1'; // heidlessemail18 in Apps-2
  const targetUid = 'AHYxlW1bIibW4LZl3LoHPbGUUaz2'; // heidlessemail18 in Sovereign-01
  const dbId = 'prompttool-db-0';

  console.log(`🛰️ Starting Global Extraction from ${sourceAccount.project_id}...`);

  try {
    const sourceDb = getFirestore(sourceApp, dbId);
    const targetDb = getFirestore(targetApp, dbId);
    
    // Fetch all images for the target user from source
    const sourceImagesRef = sourceDb.collection('users').doc(sourceUid).collection('images');
    const snapshot = await sourceImagesRef.get();
    
    console.log(`📊 Found ${snapshot.size} images to migrate.`);
    
    if (snapshot.size === 0) {
      console.log('❌ No images found for this UID in source.');
      return;
    }

    const targetImagesRef = targetDb.collection('users').doc(targetUid).collection('images');
    
    // Batch processing (max 500 per batch)
    let count = 0;
    const batch = targetDb.batch();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const migratedData = {
        ...data,
        userId: targetUid,
        authorName: 'persona v1.0 (Restored from Apps-2)',
        migrationTimestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const newDocRef = targetImagesRef.doc(doc.id);
      batch.set(newDocRef, migratedData, { merge: true });
      count++;
    });

    console.log(`🛰️ Committing batch migration of ${count} documents...`);
    await batch.commit();
    console.log(`✅ Success! Data link established for ${targetUid}.`);

  } catch (error) {
    console.error('❌ Extraction Failed:', error);
  }
}

migrateFullData().catch(console.error);
