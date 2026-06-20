import { BackupOrchestrator } from '../server/services/BackupOrchestrator.js';
import { GCSStorageProvider } from '../server/services/GCSStorageProvider.js';
import fs from 'fs-extra';
import path from 'path';

async function quickBackup() {
  console.log('🚀 INITIALIZING DIRECT METADATA SNAPSHOT (STREAM PROTOCOL)...');
  const storageProvider = new GCSStorageProvider('heidless-apps-2');
  const orchestrator = new BackupOrchestrator(storageProvider, 'heidless-apps-2');
  const targetDir = '/mnt/d/Linux-Distros/project-data/SuiteUtils/db/';
  
  try {
    const result = await orchestrator.runFullSuiteBackup({
      type: 'database',
      includeStorage: false,
      scope: 'EmergencySovereignRip',
      onProgress: (p) => console.log(`[${p.step}] ${p.message} (${p.percent || 0}%)`)
    });
    
    console.log('✅ SNAPSHOT COMPLETE LOCALLY:', result.localPath);
    
    // Move to D: Drive
    const dest = path.join(targetDir, path.basename(result.localPath));
    console.log(`📥 Moving snapshot to D: Drive: ${dest}`);
    await fs.ensureDir(targetDir);
    await fs.copy(result.localPath, dest);
    console.log('🏁 DATA SECURED ON EXTERNAL HARDWARE.');
    
  } catch (err: any) {
    console.error('❌ SNAPSHOT FAILED:', err.message);
  }
}

quickBackup();
