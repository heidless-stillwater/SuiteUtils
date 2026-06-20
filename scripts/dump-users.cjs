const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../suite-admin-sovereign-02.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id || 'stillwater-sovereign-02'
}, 'tokenmarket-read-app');

const db = getFirestore(app, 'tokenmarket-db-0');

async function run() {
  console.log('--- Querying Users Collection ---');
  const collectionRef = db.collection('users');
  const querySnapshot = await collectionRef.get();
  console.log(`Found ${querySnapshot.size} users:`);
  querySnapshot.forEach(doc => {
    console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
  });
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
