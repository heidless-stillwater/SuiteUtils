import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function check() {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/home/heidless/projects/SuiteUtils/server/config/service-account.json';
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });
  const db = getFirestore(app, 'suiteutils-db-0');
  const snap = await db.collection('deployments')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();
    
  console.log('--- Last 5 Deployments ---');
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`[${data.status}] ${data.appId} - ${data.startedAt.toDate().toISOString()}`);
    if (data.errorLogs) console.log(`   Error: ${data.errorLogs.substring(0, 100)}...`);
  });
  
  const suitesSnap = await db.collection('suites').get();
  console.log('--- Suites Status ---');
  suitesSnap.forEach(doc => {
    const apps = doc.data().apps || {};
    Object.entries(apps).forEach(([id, config]: [string, any]) => {
      console.log(`  - ${id}: ${config.environments.production?.status}`);
    });
  });
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
