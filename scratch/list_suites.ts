import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function check() {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/home/heidless/projects/SuiteUtils/server/config/service-account.json';
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });
  const db = getFirestore(app, 'suiteutils-db-0');
  const snap = await db.collection('suites').get();
  console.log('--- Suites ---');
  snap.forEach(doc => console.log(doc.id, doc.data().name));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
