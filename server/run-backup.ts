import { GCSStorageProvider } from './services/GCSStorageProvider.js';
import { BackupOrchestrator } from './services/BackupOrchestrator.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-0.firebasestorage.app';
  const credentialsPath = path.join(__dirname, 'config/service-account.json');
  
  console.log('🛠️ Initializing Backup Orchestrator...');
  const storageProvider = new GCSStorageProvider(bucketName, credentialsPath);
  const orchestrator = new BackupOrchestrator(storageProvider);

  try {
    console.log('🏁 Starting Phase 2 Validation: Full Suite Backup...');
    
    // For validation, we'll use a specific version and scope
    const result = await orchestrator.runFullSuiteBackup({
      version: '1.0.0',
      scope: 'ValidationRun',
      includeStorage: true // Let's test the whole thing!
    });

    console.log('\n✨ PHASE 2 SUCCESS!');
    console.log(`📦 Release ID: ${result.releaseId}`);
    console.log(`☁️  Cloud Path: ${result.cloudDest}`);
    console.log(`📂 Local Zip:  ${result.localPath}`);
    
  } catch (err) {
    console.error('\n❌ Backup failed!');
    console.error(err);
    process.exit(1);
  }
}

main();
