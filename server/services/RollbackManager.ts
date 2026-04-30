import { App, initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs-extra';
import path from 'path';
import unzipper from 'unzipper';
import crypto from 'crypto';
import { IStorageProvider } from './IStorageProvider.js';
import { APPS_REGISTRY, AppRecord } from './AppRegistry.js';
import { workspaceManager } from './WorkspaceManager.js';

export interface RollbackOptions {
  cloudPath: string;
  appIds: string[];
  includeStorage?: boolean;
  workspaceId?: string;
  onProgress?: (data: { message: string; type: 'info' | 'error' | 'success'; percent?: number }) => void;
}

export class RollbackManager {
  private firebaseApp: App;
  private storageProvider: IStorageProvider;
  private projectId: string;
  private localRestoreRoot: string;

  constructor(storageProvider: IStorageProvider, projectId: string = 'heidless-apps-0') {
    this.storageProvider = storageProvider;
    this.projectId = projectId;
    this.localRestoreRoot = path.join(process.cwd(), 'BACKUPS/temp_restore');
    
    this.firebaseApp = getApps().length === 0 
      ? initializeApp({ 
          credential: applicationDefault(), 
          projectId: this.projectId 
        })
      : getApps()[0];
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

      // 1. Download and Verify Backup
      onProgress?.({ message: `📥 Fetching backup from GCS...`, type: 'info', percent: 5 });
      const zipBuffer = await this.storageProvider.download(cloudPath);
      const zipPath = path.join(restoreDir, 'backup.zip');
      await fs.writeFile(zipPath, zipBuffer);

      onProgress?.({ message: `🛡️ Verifying SHA-256 integrity checksum...`, type: 'info', percent: 15 });
      try {
        const expectedChecksum = (await this.storageProvider.download(`${cloudPath}.sha256`)).toString().trim();
        const actualChecksum = await this.calculateChecksum(zipPath);

        if (expectedChecksum !== actualChecksum) {
          throw new Error(`INTEGRITY FAILURE: Checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`);
        }
        onProgress?.({ message: `✅ Integrity verified. Proceeding with restore...`, type: 'success', percent: 18 });
      } catch (err: any) {
        if (err.message.includes('INTEGRITY FAILURE')) throw err;
        onProgress?.({ message: `⚠️ No checksum found on cloud. Proceeding with caution...`, type: 'info' });
      }

      onProgress?.({ message: `📦 Extracting backup assets...`, type: 'info', percent: 20 });
      await fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: restoreDir }))
        .promise();

      // 2. Restore Databases
      const dbDir = path.join(restoreDir, 'databases');
      const targetWorkspace = workspaceId ? workspaceManager.getWorkspace(workspaceId) : null;

      for (let i = 0; i < appIds.length; i++) {
        const appId = appIds[i];
        let app = targetWorkspace 
          ? targetWorkspace.apps.find(a => a.id === appId)
          : APPS_REGISTRY.find(a => a.id === appId);

        if (!app) {
          console.warn(`[Rollback/Migrate] Skipping unknown app: ${appId}`);
          continue;
        }

        onProgress?.({ 
          message: `🔄 Restoring database for ${appId}...`, 
          type: 'info', 
          percent: 30 + (i / appIds.length) * 40 
        });
        await this.restoreAppDatabase(app, dbDir);
      }

      // 3. Restore Storage (Optional)
      if (includeStorage) {
        onProgress?.({ message: `📂 Restoring Cloud Storage assets...`, type: 'info', percent: 80 });
        const storageDir = path.join(restoreDir, 'storage');
        await this.restoreGlobalStorage(storageDir);
      }

      onProgress?.({ message: `✨ Rollback complete! System state restored.`, type: 'success', percent: 100 });

    } catch (err: any) {
      onProgress?.({ message: `❌ Rollback failed: ${err.message}`, type: 'error' });
      throw err;
    } finally {
      onProgress?.({ message: `🧹 Cleaning up local temporary files...`, type: 'info' });
      await fs.remove(restoreDir).catch(() => {});
    }
  }

  private async restoreAppDatabase(app: AppRecord, dbDir: string) {
    const db = getFirestore(this.firebaseApp, app.dbId);
    const appRestoreDir = path.join(dbDir, app.id);
    
    if (!(await fs.pathExists(appRestoreDir))) {
      console.warn(`[Rollback] No backup data found for ${app.id}`);
      return;
    }

    const files = await fs.readdir(appRestoreDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const collectionId = file.replace('.json', '');
      const data = await fs.readJson(path.join(appRestoreDir, file));
      
      console.log(`  - [${app.id}] Overwriting collection: ${collectionId}`);
      await this.importCollection(db.collection(collectionId), data);
    }
  }

  private async importCollection(collectionRef: any, data: any) {
    // 1. Wipe existing documents in this collection (simple version)
    const snapshot = await collectionRef.get();
    const batch = collectionRef.firestore.batch();
    snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();

    // 2. Import new documents
    for (const [docId, docData] of Object.entries(data)) {
      const { _subcollections, ...fields } = docData as any;
      const docRef = collectionRef.doc(docId);
      await docRef.set(fields);

      if (_subcollections) {
        for (const [subId, subData] of Object.entries(_subcollections)) {
          await this.importCollection(docRef.collection(subId), subData);
        }
      }
    }
  }

  private async restoreGlobalStorage(sourceDir: string) {
    const bucketName = `${this.projectId}.firebasestorage.app`;
    const bucket = getStorage(this.firebaseApp).bucket(bucketName);

    if (!(await fs.pathExists(sourceDir))) return;

    // This is a simplified "sync" - in production we'd want a more robust diffing sync
    const files = await this.recursiveReaddir(sourceDir);
    for (const filePath of files) {
      const relativePath = path.relative(sourceDir, filePath);
      await bucket.upload(filePath, { destination: relativePath });
    }
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
