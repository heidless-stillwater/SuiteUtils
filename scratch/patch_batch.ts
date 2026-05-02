
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

async function patchTimestamps() {
  try {
    const suiteRef = db.collection('suites').doc(suiteId);
    
    // Patch both apps
    const updates = {
      [`apps.promptmaster-v1.environments.production.lastDeployAt`]: Timestamp.now(),
      [`apps.promptmaster-v1.environments.production.status`]: 'live',
      [`apps.prompt-accreditation.environments.production.lastDeployAt`]: Timestamp.now(),
      [`apps.prompt-accreditation.environments.production.status`]: 'live',
      updatedAt: Timestamp.now()
    };

    await suiteRef.update(updates);
    console.log('✅ Successfully patched timestamps for PromptMasterSPA and PromptAccreditation.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

patchTimestamps();
