const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
async function count() {
  try {
    const collections = await db.listCollections();
    console.log('--- Database Audit ---');
    let total = 0;
    for (const coll of collections) {
      const snap = await coll.count().get();
      const c = snap.data().count;
      console.log('Collection:', coll.id, '| Count:', c);
      total += c;
    }
    console.log('TOTAL DOCUMENTS:', total);
  } catch (err) {
    console.error('ERROR:', err);
  }
}
count().then(() => process.exit(0));
