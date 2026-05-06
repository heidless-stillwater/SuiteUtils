import { getFirestore } from 'firebase-admin/firestore';
import { IStorageProvider } from './IStorageProvider.js';
import { BackupMetadata } from './BackupOrchestrator.js';

export class MigrationService {
  private storageProvider: IStorageProvider;
  private db: any;

  constructor(storageProvider: IStorageProvider, firebaseApp: any) {
    this.storageProvider = storageProvider;
    this.db = getFirestore(firebaseApp);
  }

  async consolidateStorage() {
    console.log('[Consolidation] Starting storage consolidation...');
    
    // Scan both potential locations
    const prefixes = ['AppSuite/backups/', 'backups/'];
    let movedCount = 0;

    for (const prefix of prefixes) {
      const [allFiles] = await (this.storageProvider as any).bucket.getFiles({ prefix });
      const zipFiles = allFiles.filter((f: any) => f.name.endsWith('.zip'));
      
      for (const file of zipFiles) {
        const pathParts = file.name.split('/');
        // The backup ID is either the folder name or the filename itself for root zips
        let backupFolderName = pathParts[pathParts.length - 2];
        let currentDir = file.name.substring(0, file.name.lastIndexOf('/') + 1);
        
        if (prefix === 'backups/' && pathParts.length === 2) {
          // It's in the root backups/ folder, ID is filename minus .zip
          backupFolderName = pathParts[1].replace('.zip', '');
          currentDir = file.name; // For root files, move handles the file directly
        }
        
        const targetDir = `AppSuite/backups/${backupFolderName}/`;
        
        if (currentDir !== targetDir && currentDir !== `${targetDir}${backupFolderName}.zip`) {
          console.log(`[Consolidation] Moving ${backupFolderName} from ${currentDir} to ${targetDir}`);
          try {
            // For root files, we move the file to the new folder
            if (prefix === 'backups/' && pathParts.length === 2) {
              await this.storageProvider.move(currentDir, `${targetDir}${backupFolderName}.zip`);
            } else {
              await this.storageProvider.move(currentDir, targetDir);
            }
            movedCount++;
          } catch (err) {
            console.error(`[Consolidation] Failed to move ${backupFolderName}:`, err);
          }
        }
      }
    }
    
    // After flattening the storage, run the standard migration to repair Firestore records
    const migratedCount = await this.migrateLegacyBackups();
    
    return { movedCount, migratedCount };
  }

  async migrateLegacyBackups() {
    console.log('[Migration] Starting legacy backup migration...');
    
    // We need to find all .zip files recursively under AppSuite/backups/
    const bucket = (this.storageProvider as any).bucket;
    if (!bucket) {
       console.error('[Migration] Could not access bucket directly for recursive search');
       return 0;
    }

    const [files] = await bucket.getFiles({ prefix: 'AppSuite/backups/' });
    let migratedCount = 0;

    // Filter for .zip files and avoid metadata.json itself
    const zipFiles = files.filter((f: any) => f.name.endsWith('.zip'));

    for (const file of zipFiles) {
      // The backup ID is the folder name containing the zip
      const pathParts = file.name.split('/');
      const backupFolderName = pathParts[pathParts.length - 2];
      const backupDir = file.name.substring(0, file.name.lastIndexOf('/') + 1);
      const metadataPath = `${backupDir}metadata.json`;

      // Check if metadata already exists in Firestore (primary check)
      const existingDoc = await this.db.collection('backups').doc(backupFolderName).get();
      const existingData = existingDoc.data();
      if (existingDoc.exists && existingData?.name && existingData?.status && existingData?.fullPath === backupDir) {
        console.log(`[Migration] Skipping ${backupFolderName}, already in Firestore with matching fullPath.`);
        continue;
      }

      console.log(`[Migration] Processing backup: ${backupFolderName}`);
      let metadata: any = null;

      // 1. Try to read existing metadata.json from GCS
      try {
        const buf = await this.storageProvider.download(metadataPath);
        metadata = JSON.parse(buf.toString());
        console.log(`[Migration] Found existing metadata.json for ${backupFolderName}`);
      } catch (e) {
        // 2. Fallback to parsing from name (legacy)
        console.log(`[Migration] metadata.json missing for ${backupFolderName}, attempting to parse legacy name.`);
        metadata = this.parseLegacyName(backupFolderName, backupDir, file.metadata.timeCreated);
      }
      
      if (metadata) {
        // Ensure status and fullPath are present
        metadata.status = metadata.status || 'active';
        metadata.fullPath = metadata.fullPath || backupDir;

        // Sync back to GCS if we made changes (e.g. added fullPath)
        try {
          await this.storageProvider.upload(JSON.stringify(metadata, null, 2), metadataPath, 'application/json');
        } catch (e) {
          console.error(`[Migration] Failed to sync metadata to GCS for ${backupFolderName}`, e);
        }
        
        // Save to Firestore
        await this.db.collection('backups').doc(metadata.id).set(metadata);
        migratedCount++;
      } else {
        console.warn(`[Migration] Could not resolve metadata for ${backupFolderName}, skipping.`);
      }
    }

    console.log(`[Migration] Finished. Migrated ${migratedCount} backups.`);
    return migratedCount;
  }

  private parseLegacyName(name: string, fullPath: string, fallbackTime?: string): BackupMetadata | null {
    try {
      // Format: {Scope}_v{Version}_{YYYYMMDD}_{TIMESTAMP}
      // Or: Manual_{Apps}_{AssetType}_{YYYYMMDD}_{TIMESTAMP}
      
      // Handle hyphens and underscores
      const parts = name.replace(/\/$/, '').split(/[_-]/);
      if (parts.length < 2) return null;

      // Extract basic info
      const id = name.replace(/\/$/, '');
      
      // Try to find a date/time part
      let timestamp = Date.now();
      const dateMatch = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      if (dateMatch) {
        // Handle ISO-like string from videosystem: 2026-02-02T13-39-07
        const iso = dateMatch[1].replace(/-/g, (m, offset) => offset > 10 ? ':' : '-');
        timestamp = new Date(iso).getTime();
      } else {
        const timestampPart = parts[parts.length - 1];
        if (/^\d+$/.test(timestampPart)) {
           timestamp = parseInt(timestampPart);
        }
      }
      
      if (timestamp < 1000000000) {
        // Not a real timestamp, use fallback
        timestamp = fallbackTime ? new Date(fallbackTime).getTime() : Date.now();
      }
      
      // Guess type
      let type: 'full' | 'database' | 'storage' = 'full';
      if (name.includes('DBOnly')) type = 'database';
      if (name.includes('StorageOnly')) type = 'storage';

      // Guess apps
      let apps: string[] = [];
      if (name.toLowerCase().includes('prompttool')) apps.push('prompttool');
      if (name.toLowerCase().includes('promptresources')) apps.push('promptresources');
      if (name.toLowerCase().includes('plantune')) apps.push('plantune');
      if (name.toLowerCase().includes('suiteutils')) apps.push('suiteutils');
      if (name.toLowerCase().includes('promptaccreditation')) apps.push('promptaccreditation');
      if (name.toLowerCase().includes('promptmaster')) apps.push('promptmaster');
      if (name.toLowerCase().includes('videosystem')) apps.push('videosystem');
      if (name.toLowerCase().includes('videos-system')) apps.push('videosystem');

      return {
        id,
        name: id,
        type,
        scope: parts[0] || 'Manual',
        version: name.includes('_v') ? name.split('_v')[1].split('_')[0] : '0.0.0',
        apps,
        includeStorage: type === 'full' || type === 'storage',
        timestamp,
        dateStr: new Date(timestamp).toISOString(),
        checksum: 'legacy-checksum',
        stats: {
          totalSize: 0,
          durationMs: 0
        },
        trigger: {
          type: 'manual'
        },
        isLegacy: true,
        fullPath,
        status: 'active'
      };
    } catch (err) {
      console.error(`[Migration] Failed to parse legacy name: ${name}`, err);
      return null;
    }
  }
}
