
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

async function getLatestLogs(appId) {
  console.log(`--- Fetching latest logs for ${appId} ---`);
  const snapshot = await db.collection('deployments')
    .where('appId', '==', appId)
    .limit(10) // Get last 10 and sort in memory
    .get();

  if (snapshot.empty) {
    console.log(`No deployment records found for ${appId}`);
    return;
  }

  const docs = snapshot.docs.map(d => d.data());
  docs.sort((a, b) => b.startedAt - a.startedAt);
  const data = docs[0];
  console.log(`Status: ${data.status}`);
  console.log(`Error: ${data.error || 'None'}`);
  console.log(`Started At: ${data.startedAt}`);
}

getLatestLogs('prompt-accreditation');
