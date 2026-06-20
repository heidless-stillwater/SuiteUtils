
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

async function disableGate() {
  try {
    await firestore.collection('system_config').doc('protection').update({
      avEnabled: false,
      updatedAt: new Date(),
      lastDisabledBy: 'antigravity_debug'
    });
    console.log('Successfully disabled Sovereign Gate for PromptResources');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

disableGate();
