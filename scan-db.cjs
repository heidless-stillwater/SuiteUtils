const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
async function scan() {
  try {
    const collections = await db.listCollections();
    console.log('--- Sovereign Spinal Scan ---');
    if (collections.length === 0) {
      console.log('❌ DATABASE IS TOTALLY EMPTY!');
    } else {
      collections.forEach(c => console.log('✅ Found Collection:', c.id));
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}
scan().then(() => process.exit(0));
