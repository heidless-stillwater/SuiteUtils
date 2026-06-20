
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkAllDeployments() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });

  const firestore = getFirestore(app, 'suiteutils-db-0');
  const col = await firestore.collection('deployments').get();

  if (col.empty) {
    console.log('No deployments found at all');
  } else {
    col.docs.forEach(doc => {
      const data = doc.data();
      console.log(`${doc.id}: ${data.appId} - ${data.status} at ${data.completedAt?.toDate().toISOString()}`);
    });
  }
  process.exit(0);
}

checkAllDeployments().catch(console.error);
