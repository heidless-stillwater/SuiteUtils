
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
const targetOwnerId = 'nNdenyyfKaN9yNB9Ly3vhhaHLXx1';

async function globalRepairPlanTune() {
  try {
    const suitesSnap = await db.collection('suites').where('ownerId', '==', targetOwnerId).get();
    
    if (suitesSnap.empty) {
      console.log('No suites found for owner:', targetOwnerId);
      return;
    }

    for (const doc of suitesSnap.docs) {
      await doc.ref.update({
        'apps.plantune.environments.production.hostingTarget': 'plantune-v0',
        'apps.plantune.environments.production.deployMethod': 'firebase',
        'updatedAt': new Date()
      });
      console.log(`Repaired PlanTune config in Suite: ${doc.id}`);
    }
    console.log('Global repair complete.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

globalRepairPlanTune();
