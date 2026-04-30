import { GCSStorageProvider } from './services/GCSStorageProvider.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const credentialsPath = path.join(__dirname, 'config/service-account.json');
  const bucketName = 'heidless-apps-0.firebasestorage.app'; // Default from .env
  
  console.log(`\n🔍 Using credentials from: ${credentialsPath}`);
  console.log(`🪣 Using bucket: ${bucketName}`);

  const provider = new GCSStorageProvider(bucketName, credentialsPath);

  try {
    console.log('📡 Testing connection to GCS...');
    // GCS list
    console.log('\n📂 Listing directory items (first 5)...');
    const files = await provider.list('');
    console.log(`   Found ${files.length} items.`);

    console.log('\n📝 Testing Write/Delete permissions...');
    const testFileName = `AppSuite/backups/smoke-test-${Date.now()}.txt`;
    const fileId = await provider.upload('Smoke test successful!', testFileName, 'text/plain');
    console.log(`   ✅ File created: ${testFileName} (ID: ${fileId})`);

    console.log(`   🗑️ Deleting test file...`);
    await provider.delete(testFileName);
    console.log('   ✅ File deleted successfully!');

    console.log('\n🌟 PHASE 1 VALIDATION COMPLETE: ALL SYSTEMS GREEN!');

  } catch (err) {
    console.error('\n❌ Connection failed!');
    if (err instanceof Error) {
      console.error(`   Error: ${err.message}`);
      if (err.message.includes('403')) {
        console.error('   Hint: Make sure the Google Drive API is enabled in the GCP Console for this project.');
      }
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
