import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function check() {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/home/heidless/projects/SuiteUtils/server/config/service-account.json';
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });
  const db = getFirestore(app); // Default DB
  const snap = await db.collection('deployments')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();
    
  console.log('--- Last 5 Deployments (DEFAULT DB) ---');
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`[${data.status}] ${data.appId} - ${data.startedAt.toDate().toISOString()}`);
  });
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
