const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore('persona-db-0');

async function check() {
  const doc = await db.collection('config').doc('persona_architect').get();
  if (doc.exists) {
    console.log('✅ Found:', doc.id);
    console.log('Principles:', doc.data().principles);
  } else {
    console.log('❌ persona_architect MISSING!');
  }
}
check().then(() => process.exit(0));
