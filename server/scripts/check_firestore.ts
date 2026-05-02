
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkStatus() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });

  const firestore = getFirestore(app, 'suiteutils-db-0');
  const suiteRef = firestore.collection('suites').doc('stillwater-suite');
  const doc = await suiteRef.get();

  if (!doc.exists) {
    console.log('No suite document found for stillwater-suite');
  } else {
    console.log(JSON.stringify(doc.data(), null, 2));
  }
  process.exit(0);
}

checkStatus().catch(console.error);
