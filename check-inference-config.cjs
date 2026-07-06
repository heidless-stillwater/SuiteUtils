const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');

const app = initializeApp({ credential: cert(serviceAccount) }, 'inference-gateway-app');
const db = getFirestore(app, 'inferencegateway-db-0');

async function run() {
  const docRef = db.collection('admin').doc('inferenceConfig');
  const snap = await docRef.get();
  console.log('--- INFERENCE CONFIG ---');
  if (snap.exists) {
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('Document not found!');
  }
}
run().then(() => process.exit(0)).catch(console.error);
