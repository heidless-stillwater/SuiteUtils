import { GCSStorageProvider } from './services/GCSStorageProvider.js';

async function main() {
  const bucketName = 'heidless-apps-0.firebasestorage.app';
  const credentialsPath = './server/config/service-account.json';
  const provider = new GCSStorageProvider(bucketName, credentialsPath);

  try {
    console.log(`Listing bucket: ${bucketName}...`);
    const files = await provider.list('backups');
    console.log(JSON.stringify(files, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
