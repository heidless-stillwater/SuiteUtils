
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkDeployments() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'heidless-apps-0'
  });

  const firestore = getFirestore(app, 'suiteutils-db-0');
  const col = await firestore.collection('deployments')
    .get();

  if (col.empty) {
    console.log('No deployments found');
  } else {
    const deployments = col.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(d => d.appId === 'PromptTool')
      .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
      .slice(0, 5);

    if (deployments.length === 0) {
      console.log('No deployments found for PromptTool');
    } else {
      deployments.forEach(d => {
        console.log(`Deployment ID: ${d.id}`);
        console.log(JSON.stringify(d, null, 2));
      });
    }
  }
  process.exit(0);
}

checkDeployments().catch(console.error);
