const admin = require('firebase-admin');
const path = require('path');

// Initialize with service account if needed, or use default if in authorized environment
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'stillwater-sovereign-01'
  });
}

const dbDefault = admin.firestore();
const dbPersona = admin.firestore('persona-db-0');

async function checkInsights() {
  console.log('Checking (default) database...');
  const snapshotDefault = await dbDefault.collection('insights').get();
  console.log(`Found ${snapshotDefault.size} insights in (default).`);

  if (snapshotDefault.size > 0) {
    console.log('Migrating to persona-db-0...');
    for (const doc of snapshotDefault.docs) {
      await dbPersona.collection('insights').doc(doc.id).set(doc.data());
      console.log(`Migrated insight: ${doc.id}`);
    }
    console.log('Migration complete.');
  } else {
    console.log('No insights found in (default) to migrate.');
  }
}

checkInsights().catch(console.error);
