import admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminApp = admin.app();

async function normalizeInsights() {
  const db = getFirestore(adminApp, 'persona-db-0');
  const snapshot = await db.collection('insights').get();
  
  console.log(`Normalizing ${snapshot.size} insights...`);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let updated = false;
    
    // Convert string timestamps to Firestore Timestamps
    if (typeof data.timestamp === 'string') {
      data.timestamp = Timestamp.fromDate(new Date(data.timestamp));
      updated = true;
    }
    
    // Ensure all required fields exist
    if (!data.type) { data.type = 'technical'; updated = true; }
    if (!data.source) { data.source = 'system'; updated = true; }

    if (updated) {
      await db.collection('insights').doc(doc.id).set(data);
      console.log(`Normalized insight: ${doc.id}`);
    }
  }
  console.log('Normalization complete.');
}

normalizeInsights().catch(console.error);
