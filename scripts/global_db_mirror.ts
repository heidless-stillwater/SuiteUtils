import admin from 'firebase-admin';
import { getFirestore, CollectionReference, QuerySnapshot, DocumentData } from 'firebase-admin/firestore';
import fs from 'fs';

// Configuration
const sourceKeyPath = './scratch/service-account-target.json'; // heidless-apps-2
const targetKeyPath = './suite-admin-sovereign.json';         // stillwater-sovereign-01

const sourceAccount = JSON.parse(fs.readFileSync(sourceKeyPath, 'utf8'));
const targetAccount = JSON.parse(fs.readFileSync(targetKeyPath, 'utf8'));

// Initialize Apps
const sourceApp = admin.initializeApp({ credential: admin.credential.cert(sourceAccount) }, 'global_source');
const targetApp = admin.initializeApp({ credential: admin.credential.cert(targetAccount) }, 'global_target');

const sourceDb = getFirestore(sourceApp, 'prompttool-db-0');
const targetDb = getFirestore(targetApp, 'prompttool-db-0');

async function copyCollection(sourcePath: string, targetPath: string) {
  console.log(`🛰️ Mirroring Collection: ${sourcePath} ➔ ${targetPath}`);
  
  const sourceRef = sourceDb.collection(sourcePath);
  const snapshot = await sourceRef.get();
  
  if (snapshot.empty) return;

  const batch = targetDb.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const targetDocRef = targetDb.doc(`${targetPath}/${doc.id}`);
    batch.set(targetDocRef, data, { merge: true });
    count++;

    // Recursively copy subcollections
    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      await copyCollection(`${sourcePath}/${doc.id}/${sub.id}`, `${targetPath}/${doc.id}/${sub.id}`);
    }

    if (count >= 400) {
      await batch.commit();
      console.log(`✅ Committed intermediate batch of ${count} documents.`);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Final batch committed: ${count} documents for ${sourcePath}.`);
  }
}

async function startGlobalMirror() {
  const roots = [
    '_diagnostic', 'blueprints', 'config', 'leagueEntries', 'prompts', 
    'publishedResources', 'system', 'system_config', 'system_settings', 
    'usage_history', 'users', 'votes'
  ];

  console.log('🏰 STARTING GLOBAL MIRROR PROTOCOL 🏰');
  
  for (const root of roots) {
    try {
      await copyCollection(root, root);
    } catch (error) {
      console.error(`❌ Failed to mirror root collection ${root}:`, error);
    }
  }

  console.log('🎯 GLOBAL MIRROR COMPLETE 🎯');
}

startGlobalMirror().catch(console.error);
