
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

async function listSuites() {
  try {
    const suites = await db.collection('suites').get();
    console.log('Suites found:');
    suites.forEach(doc => console.log(`- ${doc.id}`));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listSuites();
