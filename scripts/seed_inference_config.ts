import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountPath = './suite-admin-sovereign-02.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account key not found at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize app if not already initialized
let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'stillwater-sovereign-02'
  });
} else {
  app = admin.app();
}

const db = getFirestore(app, 'inferencegateway-db-0');

const initialInferenceConfig = {
  activeSource: 'localhost',
  gcpEndpoint: 'http://<GCP_VM_IP>:11434',
  gcpHardware: 'NVIDIA L4 (24GB VRAM)',
  vmStatus: 'STOPPED',
  enabledModels: ['llama3.2', 'phi3'],
  updatedAt: new Date().toISOString()
};

const modelRegistry = {
  catalog: [
    { name: 'llama3.2', tags: ['latest', '3b'], size: '2.0GB', description: 'Meta lightweight model.' },
    { name: 'llama3.2:1b', tags: ['latest', '1b'], size: '1.3GB', description: 'Meta ultra-lightweight model.' },
    { name: 'phi3', tags: ['mini'], size: '2.3GB', description: 'Microsoft highly capable small model.' },
    { name: 'gemma2', tags: ['9b'], size: '5.5GB', description: 'Google open weights model.' },
    { name: 'gemma2:2b', tags: ['2b'], size: '1.6GB', description: 'Google small open weights model.' },
    { name: 'mistral', tags: ['v0.3'], size: '4.1GB', description: 'Mistral AI 7B model.' },
    { name: 'qwen2.5-coder', tags: ['7b'], size: '4.7GB', description: 'Alibaba code specialist model.' },
    { name: 'llama3:8b', tags: ['8b'], size: '4.7GB', description: 'Meta Llama 3 8B.' },
    { name: 'llama3:70b', tags: ['70b'], size: '40GB', description: 'Meta Llama 3 70B.' },
    { name: 'tinyllama', tags: ['1.1b'], size: '637MB', description: 'Compact Llama architecture model.' }
  ],
  updatedAt: new Date().toISOString()
};

async function seed() {
  console.log('🏁 Starting InferenceGateway database seeding...');
  
  const adminCollection = db.collection('admin');
  
  console.log('Seeding admin/inferenceConfig...');
  await adminCollection.doc('inferenceConfig').set(initialInferenceConfig);
  console.log('✅ inferenceConfig successfully saved.');

  console.log('Seeding admin/modelRegistry...');
  await adminCollection.doc('modelRegistry').set(modelRegistry);
  console.log('✅ modelRegistry successfully saved.');

  console.log('🎉 Seeding successfully completed!');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
