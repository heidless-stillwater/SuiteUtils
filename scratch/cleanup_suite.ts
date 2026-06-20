
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
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

async function cleanupSuite() {
  try {
    const suiteRef = db.collection('suites').doc(suiteId);
    
    // 1. Move timestamps to correct IDs
    const updates = {
      [`apps.promptmasterspa.environments.production.lastDeployAt`]: Timestamp.now(),
      [`apps.promptmasterspa.environments.production.status`]: 'live',
      [`apps.promptaccreditation.environments.production.lastDeployAt`]: Timestamp.now(),
      [`apps.promptaccreditation.environments.production.status`]: 'live',
      
      // 2. Delete the ghost entries
      [`apps.prompt-accreditation`]: FieldValue.delete(),
      [`apps.promptmaster-v1`]: FieldValue.delete(),
      
      updatedAt: Timestamp.now()
    };

    await suiteRef.update(updates);
    console.log('✅ Successfully cleaned up ghost entries and merged timestamps.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

cleanupSuite();
