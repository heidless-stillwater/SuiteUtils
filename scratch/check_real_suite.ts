import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function check() {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/home/heidless/projects/SuiteUtils/server/config/service-account.json';
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });
  const db = getFirestore(app, 'suiteutils-db-0');
  const doc = await db.collection('suites').doc('10NmkWosJCbzF2bdyX2A').get();
  
  if (!doc.exists) {
    console.log('10NmkWosJCbzF2bdyX2A DOES NOT EXIST');
  } else {
    console.log('--- 10NmkWosJCbzF2bdyX2A ---');
    console.log(JSON.stringify(doc.data()?.apps?.['ag-video-system']?.environments?.production, null, 2));
  }
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
