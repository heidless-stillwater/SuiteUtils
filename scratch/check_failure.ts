
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(__dirname, '../server/config/service-account.json');

const app = getApps().length === 0 
  ? initializeApp({ 
      credential: cert(credentialsPath), 
      projectId: 'heidless-apps-0' 
    })
  : getApps()[0];

const db = getFirestore(app, 'suiteutils-db-0');

async function checkLatestFailure() {
  try {
    const logs = await db.collection('deployments')
      .where('appId', '==', 'plantune')
      .get();
    
    if (logs.empty) {
      console.log('No logs found for plantune');
      return;
    }

    const docs = logs.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a: any, b: any) => b.startedAt.toMillis() - a.startedAt.toMillis());
    const data = docs[0] as any;
    console.log('Latest PlanTune Deployment:');
    console.log(`Status: ${data.status}`);
    console.log(`Started At: ${data.startedAt.toDate().toISOString()}`);
    console.log('Error Logs:');
    console.log(data.errorLogs || 'No error message stored.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkLatestFailure();
