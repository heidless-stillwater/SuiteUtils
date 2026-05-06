import { GCSStorageProvider } from './services/GCSStorageProvider.js';
import { MigrationManager } from './services/MigrationManager.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const releaseId = process.argv[2];
  if (!releaseId) {
    console.error('❌ Usage: npx tsx server/migrate-exemplar.ts <releaseId>');
    process.exit(1);
  }

  let sourceBackupPath: string;
  if (releaseId.endsWith('.zip') || releaseId.includes('/')) {
    sourceBackupPath = releaseId;
  } else {
    sourceBackupPath = `AppSuite/backups/${releaseId}/${releaseId}.zip`;
  }
  const targetWorkspaceId = 'new-gcp-server';
  
  const bucketName = process.env.GCS_BUCKET_NAME || 'heidless-apps-0.firebasestorage.app';
  const credentialsPath = path.join(__dirname, 'config/service-account.json');
  
  console.log(`🚀 Initializing Migration of Exemplar [${releaseId}] to [${targetWorkspaceId}]...`);
  const storageProvider = new GCSStorageProvider(bucketName, credentialsPath);
  const migrationManager = new MigrationManager(storageProvider);

  try {
    const result = await migrationManager.executeMigration(sourceBackupPath, targetWorkspaceId, (progress: any) => {
      console.log(`[Progress] ${progress.percent || '??'}% | ${progress.message}`);
    });

    console.log('\n✨ MIGRATION SUCCESS!');
    console.log(`🏢 Target Workspace: ${result.targetWorkspace}`);
    console.log(`🧪 Target Project:   ${result.targetProject}`);
    console.log(`📦 Apps Migrated:    ${result.appCount}`);
    console.log(`⏱️  Duration:         ${(result.durationMs / 1000).toFixed(1)}s`);
    
  } catch (err) {
    console.error('\n❌ Migration failed!');
    console.error(err);
    process.exit(1);
  }
}

main();
