
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

const toolDb = getFirestore(app, 'prompttool-db-0');
const targetUid = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';
const targetEmail = 'heidlessemail18@gmail.com';

async function syncUser() {
  try {
    await toolDb.collection('users').doc(targetUid).set({
      uid: targetUid,
      email: targetEmail,
      displayName: 'rob',
      role: 'admin',
      subscription: 'pro',
      updatedAt: new Date()
    }, { merge: true });
    console.log('Successfully synced admin user to PromptTool DB');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

syncUser();
