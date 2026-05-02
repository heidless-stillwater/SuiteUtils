
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

const targetUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
const dbs = ['prompttool-db-0', 'promptresources-db-0', 'suiteutils-db-0'];

async function elevateUser() {
  try {
    for (const dbName of dbs) {
      const db = getFirestore(app, dbName);
      await db.collection('users').doc(targetUid).update({
        role: 'su',
        updatedAt: new Date()
      });
      console.log(`Elevated user to SU in ${dbName}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

elevateUser();
