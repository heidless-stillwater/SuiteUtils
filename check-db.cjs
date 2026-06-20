const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  console.log('--- Sovereign Config Check ---');
  const snapshot = await db.collection('config').get();
  if (snapshot.empty) {
    console.log('❌ Collection [config] is EMPTY!');
  } else {
    snapshot.forEach(doc => {
      console.log('✅ Found Doc:', doc.id);
    });
  }
}
check();
