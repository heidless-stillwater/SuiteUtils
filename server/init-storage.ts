import { GCSStorageProvider } from './services/GCSStorageProvider.js';

async function main() {
  const bucketName = 'heidless-apps-0.firebasestorage.app';
  const credentialsPath = './server/config/service-account.json';
  const provider = new GCSStorageProvider(bucketName, credentialsPath);

  try {
    console.log('Creating placeholder for AppSuite/backups...');
    await provider.createFolder('backups', 'AppSuite');
    console.log('✅ Placeholder created successfully.');
  } catch (err) {
    console.error(err);
  }
}

main();
