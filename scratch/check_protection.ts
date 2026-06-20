
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

const firestore = getFirestore(app, 'promptresources-db-0');
const toolDb = getFirestore(app, 'prompttool-db-0');

async function checkConfig() {
  try {
    const doc = await firestore.collection('system_config').doc('protection').get();
    console.log('Protection Config:', JSON.stringify(doc.data(), null, 2));

    const userEmail = 'lockhart.r@gmail.com';
    const dbs = ['prompttool-db-0', 'promptmaster-spa-db-0', 'promptresources-db-0', 'suiteutils-db-0'];
    
    const targetUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
    const db = getFirestore(app, 'prompttool-db-0');
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      console.log('User Record:', JSON.stringify({
        photoURL: data?.photoURL,
        updatedAt: data?.updatedAt?.toDate()?.toISOString()
      }, null, 2));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

checkConfig();
