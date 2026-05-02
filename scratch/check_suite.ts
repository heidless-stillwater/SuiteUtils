
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
const suiteId = 'OlgqXSyKR8Cm3gUZErE7';

async function checkSuiteData() {
  try {
    const doc = await db.collection('suites').doc(suiteId).get();
    if (!doc.exists) {
      console.log('Suite not found:', suiteId);
      return;
    }
    const data = doc.data();
    console.log('--- All Apps in Suite ---');
    for (const [id, app] of Object.entries(data.apps || {})) {
      console.log(`ID: ${id} | Name: ${app.displayName || 'MISSING'}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSuiteData();
