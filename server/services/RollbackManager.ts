import { App, initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs-extra';
import path from 'path';
import unzipper from 'unzipper';
import crypto from 'crypto';
import { IStorageProvider } from './IStorageProvider.js';
import { workspaceManager } from './WorkspaceManager.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RollbackOptions {
  cloudPath: string;
  appIds: string[];
  includeStorage?: boolean;
  workspaceId?: string;
  onProgress?: (event: { 
    message: string; 
    step: 'info' | 'error' | 'success'; 
    percent?: number;
    metrics?: {
      totalSize: number;
      transferredSize: number;
      elapsed: number;
      eta: number;
      speed: number;
    };
  }) => void;
}

export class RollbackManager {
  private firebaseApp: App;
  public storageProvider: IStorageProvider;
  private projectId: string;
  private localRestoreRoot: string;

  constructor(storageProvider: IStorageProvider, projectId: string = 'heidless-apps-0') {
    this.storageProvider = storageProvider;
    this.projectId = projectId;
    this.localRestoreRoot = path.join(process.cwd(), 'BACKUPS/temp_restore');
    
    const appName = `restore-${this.projectId}`;
    const existingApp = getApps().find(a => a.name === appName);

    if (existingApp) {
      this.firebaseApp = existingApp;
    } else {
      let credential = applicationDefault();
      
      // If we are targeting heidless-apps-2, use the specific service account key if it exists
      if (this.projectId === 'heidless-apps-2') {
        const targetKeyPath = path.join(process.cwd(), 'server/config/service-account-target.json');
        if (fs.existsSync(targetKeyPath)) {
          console.log(`[RollbackManager] Loading target service account for ${this.projectId}`);
          credential = cert(targetKeyPath);
        }
      }

      this.firebaseApp = initializeApp({ 
        credential, 
        projectId: this.projectId 
      }, appName);
    }
  }

  async getDatabaseStatus(dbId: string): Promise<'MISSING' | 'EXISTS_EMPTY' | 'EXISTS_DATA'> {
    try {
      const db = getFirestore(this.firebaseApp, dbId);
      const collections = await db.listCollections();
      if (collections.length === 0) return 'EXISTS_EMPTY';
      return 'EXISTS_DATA';
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('NOT_FOUND') || msg.includes('database does not exist')) {
        return 'MISSING';
      }
      // If we can't reach it, we'll assume it's missing for provisioning purposes
      console.warn(`[RollbackManager] Could not determine status for ${dbId}:`, msg);
      return 'MISSING';
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async performRollback(options: RollbackOptions) {
    const { cloudPath, appIds, includeStorage, workspaceId, onProgress } = options;
    const localId = cloudPath.split('/').pop()?.replace('.zip', '') || `restore_${Date.now()}`;
    const restoreDir = path.join(this.localRestoreRoot, localId);
    
    try {
      await fs.ensureDir(restoreDir);

      // 0. Resolve actual zip path if it's a directory
      let actualCloudPath = cloudPath;
      if (cloudPath.endsWith('/')) {
        onProgress?.({ message: '🔍 Resolving backup archive location...', step: 'info', percent: 2 });
        const files = await this.storageProvider.list(cloudPath);
        const zipFile = files.find(f => f.name.endsWith('.zip'));
        if (!zipFile) throw new Error(`Could not find a .zip archive in ${cloudPath}`);
        actualCloudPath = zipFile.fullPath || zipFile.id;
      }

      const zipPath = path.join(restoreDir, 'backup.zip');
      let downloadedSize = 0;
      let totalSize = 0;
      
      // 1. Check if it's already a local file (bypasses download)
      if (await fs.pathExists(cloudPath) && (await fs.stat(cloudPath)).isFile()) {
        onProgress?.({ message: `📂 Using local backup file: ${path.basename(cloudPath)}`, step: 'info', percent: 14 });
        await fs.copy(cloudPath, zipPath);
        downloadedSize = (await fs.stat(zipPath)).size;
        totalSize = downloadedSize;
      } else {
        // Download from cloud
        onProgress?.({ message: `☁️ Downloading backup from cloud: ${path.basename(actualCloudPath)}...`, step: 'info', percent: 5 });
    
        const writeStream = fs.createWriteStream(zipPath);
        const readStream = await this.storageProvider.downloadStream(actualCloudPath);
        
        const syncStartTime = Date.now();
        
        // Get total size for metrics if possible
        const file = (this.storageProvider as any).bucket?.file(actualCloudPath.startsWith('/') ? actualCloudPath.slice(1) : actualCloudPath);
        if (file) {
          const [metadata] = await file.getMetadata();
          totalSize = parseInt(metadata.size);
        }

        await new Promise((resolve, reject) => {
          readStream.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const elapsed = (Date.now() - syncStartTime) / 1000;
              const speed = downloadedSize / elapsed;
              const remaining = totalSize - downloadedSize;
              const eta = speed > 0 ? Math.round(remaining / speed) : 0;
              
              onProgress?.({
                message: `☁️ Downloading backup (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)...`,
                step: 'info',
                percent: 5 + Math.floor((downloadedSize / totalSize) * 10),
                metrics: {
                  totalSize,
                  transferredSize: downloadedSize,
                  elapsed,
                  eta,
                  speed
                }
              });
            }
          });

          readStream.pipe(writeStream)
            .on('finish', () => resolve(undefined))
            .on('error', reject);
        });
      }

      onProgress?.({ message: `🛡️ Verifying SHA-256 integrity checksum...`, step: 'info', percent: 15 });
      try {
        const expectedChecksum = (await this.storageProvider.download(`${cloudPath}.sha256`)).toString().trim();
        const actualChecksum = await this.calculateChecksum(zipPath);

        if (expectedChecksum !== actualChecksum) {
          throw new Error(`INTEGRITY FAILURE: Checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`);
        }
        onProgress?.({ message: `✅ Integrity verified. Proceeding with restore...`, step: 'success', percent: 18 });
      } catch (err: any) {
        if (err.message.includes('INTEGRITY FAILURE')) throw err;
        onProgress?.({ message: `⚠️ No checksum found on cloud. Proceeding with caution...`, step: 'info' });
      }

      onProgress?.({ message: `📦 Extracting backup assets (using Python for stability)...`, step: 'info', percent: 20 });
      try {
        await execAsync(`python3 -m zipfile -e "${zipPath}" "${restoreDir}"`);
      } catch (extractErr: any) {
        console.error('[Rollback] Python extraction failed:', extractErr);
        // Fallback to unzipper just in case, though it failed before
        await fs.createReadStream(zipPath)
          .pipe(unzipper.Extract({ path: restoreDir }))
          .promise();
      }

      // Recursive root detection: find the folder containing 'databases' or 'storage'
      const findDataRoot = async (dir: string): Promise<string> => {
        const items = await fs.readdir(dir);
        if (items.includes('databases') || items.includes('storage')) {
          return dir;
        }
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if ((await fs.stat(fullPath)).isDirectory() && item !== '__MACOSX') {
            const result = await findDataRoot(fullPath);
            if (result !== fullPath || (await fs.readdir(result)).some(i => ['databases', 'storage'].includes(i))) {
              return result;
            }
          }
        }
        return dir;
      };

      const actualDataDir = await findDataRoot(restoreDir);
      console.log(`[Rollback] Discovered data root at: ${actualDataDir}`);

      // 2. Restore Databases
      const dbDir = path.join(actualDataDir, 'databases');
      const targetWorkspace = workspaceId ? workspaceManager.getWorkspace(workspaceId) : null;

      if (await fs.pathExists(dbDir)) {
        const backupFolders = await fs.readdir(dbDir);
        console.log(`[Rollback] Available folders in backup/databases: ${backupFolders.join(', ')}`);

        for (let i = 0; i < appIds.length; i++) {
          const appId = appIds[i];
          let app = targetWorkspace 
            ? targetWorkspace.apps.find(a => a.id === appId)
            : APPS_REGISTRY.find(a => a.id === appId);

          if (!app) {
            console.warn(`[Rollback/Migrate] Skipping unknown app: ${appId}`);
            continue;
          }

          // Fuzzy match: try exact, then try if appId contains folder name or vice versa
          let actualFolder = backupFolders.find(f => f === appId);
          if (!actualFolder) {
            actualFolder = backupFolders.find(f => appId.includes(f) || f.includes(appId));
          }

          if (!actualFolder) {
            console.warn(`[Rollback] No backup data found for ${appId} (searched for: ${appId})`);
            continue;
          }

          onProgress?.({ 
            message: `🔄 Restoring database for ${appId}...`, 
            step: 'info', 
            percent: 30 + (i / appIds.length) * 40 
          });
          
          const appRestoreDir = path.join(dbDir, actualFolder);
          await this.restoreAppDatabase(app, appRestoreDir);
        }
      } else {
        console.log(`[Rollback] No 'databases' directory found in backup. Skipping database restoration.`);
      }

      // 3. Restore Storage (Optional)
      if (includeStorage) {
        onProgress?.({ message: `📂 Restoring Cloud Storage assets...`, step: 'info', percent: 80 });
        const storageDir = path.join(actualDataDir, 'storage');
        await this.restoreGlobalStorage(storageDir);
      }

      // 4. Restore Security Rules
      const firestoreRules = path.join(actualDataDir, 'firestore.rules');
      const storageRules = path.join(actualDataDir, 'storage.rules');
      
      const [fsExists, stExists] = await Promise.all([
        fs.pathExists(firestoreRules),
        fs.pathExists(storageRules)
      ]);

      if (fsExists || stExists) {
        onProgress?.({ message: `🛡️ Synchronizing security rules from backup...`, step: 'info', percent: 90 });
        const { securityManager } = await import('./SecurityManager.js');
        // We pass the actual data dir as the 'projectPath' where rules are located
        await securityManager.deployRules(this.projectId, actualDataDir, (msg) => {
          onProgress?.({ message: msg, step: 'info', percent: 95 });
        });
      }

      onProgress?.({ message: `✨ Rollback complete! System state restored.`, step: 'success', percent: 100 });

    } catch (err: any) {
      onProgress?.({ message: `❌ Rollback failed: ${err.message}`, step: 'error' });
      throw err;
    } finally {
      onProgress?.({ message: `🧹 (Debug) Skipping cleanup of local temporary files.`, step: 'info' });
      // await fs.remove(restoreDir).catch(() => {});
    }
  }

  private async restoreAppDatabase(app: AppRecord, appRestoreDir: string) {
    const db = getFirestore(this.firebaseApp, app.dbId);
    
    console.log(`[Rollback/Migrate] Targeting Project: ${this.projectId} | Database: ${app.dbId}`);
    
    if (!(await fs.pathExists(appRestoreDir))) {
      console.warn(`[Rollback] No backup data folder found at: ${appRestoreDir}`);
      return;
    }

    const files = await fs.readdir(appRestoreDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const collectionId = file.replace('.json', '');
      const data = await fs.readJson(path.join(appRestoreDir, file));
      
      console.log(`  - [${app.id}] Restoring collection: ${collectionId} (${Object.keys(data).length} docs)`);
      await this.importCollection(db.collection(collectionId), data);
    }
  }

  private async importCollection(collectionRef: any, data: any) {
    // 1. Wipe existing documents in this collection
    const snapshot = await collectionRef.get();
    if (snapshot.size > 0) {
      const wipeBatch = collectionRef.firestore.batch();
      snapshot.docs.forEach((doc: any) => wipeBatch.delete(doc.ref));
      await wipeBatch.commit();
      console.log(`  - [Wipe] Cleared ${snapshot.size} existing documents.`);
    }

    // 2. Import new documents in batches of 500 (Firestore limit)
    const entries = Object.entries(data);
    const CHUNK_SIZE = 500;
    
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      const batch = collectionRef.firestore.batch();
      
      for (const [docId, docData] of chunk) {
        const { _subcollections, ...fields } = docData as any;
        const docRef = collectionRef.doc(docId);
        batch.set(docRef, fields);
        
        // Handle subcollections (recursively, but separately to avoid exceeding batch limits easily)
        if (_subcollections) {
          for (const [subId, subData] of Object.entries(_subcollections)) {
            await this.importCollection(docRef.collection(subId), subData);
          }
        }
      }
      
      await batch.commit();
    }
  }

  private async restoreGlobalStorage(sourceDir: string) {
    const bucketName = `${this.projectId}.firebasestorage.app`;
    const bucket = getStorage(this.firebaseApp).bucket(bucketName);

    if (!(await fs.pathExists(sourceDir))) return;

    // This is a simplified "sync" - in production we'd want a more robust diffing sync
    const files = await this.recursiveReaddir(sourceDir);
    
    // Create a monitor document in the target project's default Firestore database
    // This allows the user to monitor progress from the Firestore Console
    const db = getFirestore(this.firebaseApp);
    const monitorRef = db.collection('system_sync').doc('storage_restoration');
    
    await monitorRef.set({
      status: 'running',
      totalFiles: files.length,
      processedFiles: 0,
      percent: 0,
      startTime: new Date().toISOString(),
      projectId: this.projectId,
      source: 'RollbackManager/MigrationEngine'
    }).catch(err => console.warn('[Rollback] Failed to initialize Firestore monitor:', err.message));

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const relativePath = path.relative(sourceDir, filePath);
      await bucket.upload(filePath, { destination: relativePath });
      
      // Update monitor every 5 files to reduce write overhead but maintain visibility
      if (i % 5 === 0 || i === files.length - 1) {
        await monitorRef.update({
          processedFiles: i + 1,
          lastFile: relativePath,
          percent: Math.round(((i + 1) / files.length) * 100),
          lastUpdate: new Date().toISOString()
        }).catch(() => {}); // Ignore monitor update failures to avoid blocking the sync
      }
    }

    await monitorRef.update({
      status: 'complete',
      endTime: new Date().toISOString(),
      percent: 100
    }).catch(() => {});
  }

  private async recursiveReaddir(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? this.recursiveReaddir(res) : res;
    }));
    return Array.prototype.concat(...files);
  }
}
