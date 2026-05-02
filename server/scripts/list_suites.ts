
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function listDocs() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });

  const firestore = getFirestore(app, 'suiteutils-db-0');
  const col = await firestore.collection('suites').get();

  col.docs.forEach(doc => {
    const data = doc.data();
    if (data.apps && data.apps.PromptTool) {
      console.log(`Document ID: ${doc.id}`);
      console.log(JSON.stringify(data.apps.PromptTool, null, 2));
    }
  });
  process.exit(0);
}

listDocs().catch(console.error);
