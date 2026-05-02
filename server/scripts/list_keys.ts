
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function listKeys() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });

  const firestore = getFirestore(app, 'suiteutils-db-0');
  const doc = await firestore.collection('suites').doc('stillwater-suite').get();

  if (!doc.exists) {
    console.log('Document stillwater-suite does not exist');
  } else {
    const data = doc.data();
    console.log('Keys in stillwater-suite apps:', Object.keys(data?.apps || {}));
    if (data?.apps) {
        Object.keys(data.apps).forEach(key => {
            console.log(`${key} status:`, data.apps[key].environments?.production?.status);
        });
    }
  }
  process.exit(0);
}

listKeys().catch(console.error);
