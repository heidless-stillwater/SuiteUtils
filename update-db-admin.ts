import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: 'heidless-apps-0'
});

const db = getFirestore();
db.settings({ databaseId: 'suiteutils-db-0' });

async function run() {
  const snap = await db.collection('suites').get();
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.apps && data.apps.suiteutils) {
      data.apps.suiteutils.environments.production.status = 'live';
      await db.collection('suites').doc(docSnap.id).update({
        'apps.suiteutils': data.apps.suiteutils
      });
      console.log('Updated suite: ' + docSnap.id);
    }
  }
}
run().catch(console.error);
