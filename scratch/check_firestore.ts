import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';

const firebaseApp = getApps().length === 0 
  ? initializeApp({ 
      credential: cert(path.join(process.cwd(), 'server', 'config', 'service-account.json')),
      projectId: 'heidless-apps-0' 
    })
  : getApps()[0];

const firestore = getFirestore(firebaseApp, 'suiteutils-db-0');

async function checkSuites() {
  const snap = await firestore.collection('suites').get();
  snap.forEach(doc => {
    console.log('ID:', doc.id);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });
}

checkSuites().catch(console.error);
