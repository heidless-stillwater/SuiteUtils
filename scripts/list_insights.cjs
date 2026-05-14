const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'stillwater-sovereign-01'
  });
}

const db = admin.firestore('persona-db-0');

async function listInsights() {
  const snapshot = await db.collection('insights').get();
  console.log(`Found ${snapshot.size} insights.`);
  snapshot.docs.forEach(doc => {
    console.log(`- [${doc.id}]: ${doc.data().content.substring(0, 50)}...`);
  });
}

listInsights().catch(console.error);
