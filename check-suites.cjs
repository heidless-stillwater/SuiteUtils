const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./suite-admin-sovereign.json');

initializeApp({ credential: cert(serviceAccount) });
// Connect specifically to suiteutils-db-0
const db = getFirestore(undefined, 'suiteutils-db-0');

async function check() {
  console.log('--- checking suites collection in suiteutils-db-0 ---');
  const snapshot = await db.collection('suites').get();
  if (snapshot.empty) {
    console.log('❌ Collection [suites] is EMPTY in suiteutils-db-0!');
  } else {
    snapshot.forEach(doc => {
      console.log('✅ Found Suite Doc ID:', doc.id);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
  }
}
check().then(() => process.exit(0));
