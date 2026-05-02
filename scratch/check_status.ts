import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function check() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });
  const db = getFirestore(app);
  const snap = await db.collection('suites').get();
  snap.forEach(doc => {
    console.log(`Suite: ${doc.id} (${doc.data().name})`);
    const apps = doc.data().apps || {};
    Object.entries(apps).forEach(([id, config]: [string, any]) => {
      console.log(`  - ${id}: ${config.environments.production?.status} (Last: ${config.environments.production?.lastDeployAt?.toDate?.() || 'never'})`);
    });
  });
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
