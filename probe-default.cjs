const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(); // DEFAULT

async function check() {
  const doc = await db.collection('config').doc('persona_architect').get();
  if (doc.exists) {
    console.log('✅ Found in DEFAULT:', doc.data().principles);
  } else {
    console.log('❌ NOT in DEFAULT.');
  }
}
check().then(() => process.exit(0));
