import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const sourceKeyPath = './scratch/service-account-target.json'; // heidless-apps-2
const sourceAccount = JSON.parse(fs.readFileSync(sourceKeyPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sourceAccount)
  });
}

async function listRootCollections() {
  console.log(`🛰️ Listing Root Collections in ${sourceAccount.project_id}...`);
  try {
    const db = getFirestore(admin.app(), 'prompttool-db-0');
    const collections = await db.listCollections();
    
    console.log('📊 Root Collections:');
    for (const col of collections) {
      const snapshot = await col.limit(1).get();
      console.log(`- ${col.id} (Size: ${snapshot.size > 0 ? 'exists' : 'empty'})`);
    }
  } catch (error) {
    console.error('❌ Failed to list collections:', error);
  }
}

listRootCollections().catch(console.error);
