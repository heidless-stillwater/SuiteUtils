import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function check() {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/home/heidless/projects/SuiteUtils/server/config/service-account.json';
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });
  const db = getFirestore(app, 'suiteutils-db-0');
  const collections = await db.listCollections();
  console.log('--- Collections ---');
  collections.forEach(c => console.log(c.id));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
