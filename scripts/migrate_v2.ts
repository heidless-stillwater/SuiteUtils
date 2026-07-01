import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'stillwater-sovereign-02'
  });
}

const adminApp = admin.app();

async function checkInsights() {
  try {
    const dbPromptTool = getFirestore(adminApp, 'prompttool-db-0');
    const dbPersona = getFirestore(adminApp, 'persona-db-0');

    console.log('Checking prompttool-db-0 database...');
    const snapshot = await dbPromptTool.collection('insights').get();
    console.log(`Found ${snapshot.size} insights in prompttool-db-0.`);

    if (snapshot.size > 0) {
      console.log('Migrating to persona-db-0...');
      for (const doc of snapshot.docs) {
        await dbPersona.collection('insights').doc(doc.id).set(doc.data());
        console.log(`Migrated insight: ${doc.id}`);
      }
      console.log('Migration complete.');
    } else {
      console.log('No insights found in prompttool-db-0 to migrate.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

checkInsights().catch(console.error);
