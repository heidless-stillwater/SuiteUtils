import { initializeApp, applicationDefault, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { IStorageProvider } from './IStorageProvider.js';
import { APPS_REGISTRY, AppRecord } from './AppRegistry.js';
import { auditLogger } from './AuditLogger.js';
import { operationMonitor } from './OperationMonitor.js';
import { notificationManager } from './NotificationManager.js';
import crypto from 'crypto';

export interface BackupOptions {
  version?: string;
  scope?: string;
  type?: 'full' | 'database' | 'storage';
  includeStorage?: boolean;
  onProgress?: (event: BackupProgressEvent) => void;
  signal?: AbortSignal;
  appIds?: string[];
  releaseId?: string;
  name?: string;
}

export interface BackupMetadata {
  id: string;
  type: 'full' | 'database' | 'storage';
  scope: string;
  version: string;
  apps: string[];
  includeStorage: boolean;
  timestamp: number;
  dateStr: string;
  checksum: string;
  stats: {
    totalSize: number;
    durationMs: number;
    fileCount?: number;
  };
  trigger: {
    type: 'manual' | 'scheduled';
    user?: string;
  };
  name?: string;
  isLegacy?: boolean;
  fullPath?: string;
  status?: 'active' | 'archived';
  storageStatus?: 'success' | 'failed' | 'skipped';
}

export type BackupProgressEvent = {
  step: 'db' | 'storage' | 'zip' | 'cloud' | 'complete' | 'error' | 'info';
  message: string;
  appId?: string;
  percent?: number;
  metrics?: {
    totalSize: number;
    transferredSize: number;
    elapsed: number;
    eta: number;
    speed: number;
  };
};

export class BackupOrchestrator {
  private firebaseApp: App;
  private storageProvider: IStorageProvider;
  private projectId: string;
  private localBackupRoot: string;
  private currentSignal?: AbortSignal;
  private readonly WHITELISTED_ROOT_DIRS = [
    'AppSuite',
    'avatars',
    'banners',
    'attachments',
    'unitImages',
    'user-uploads',
    'media'
  ];

  constructor(storageProvider: IStorageProvider, projectId: string = 'heidless-apps-0') {
    this.storageProvider = storageProvider;
    this.projectId = projectId;
    this.localBackupRoot = path.join(process.cwd(), 'BACKUPS');
    
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

  public generateBackupId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${now.getDate().toString().padStart(2, '0')}${months[now.getMonth()]}${now.getFullYear()}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    
    return `backup_${randomPart}-${dateStr}-${timeStr}`;
  }

  /**
   * Main entry point for a full suite backup
   */
  async runFullSuiteBackup(options: BackupOptions = {}, controller?: AbortController) {
    const { 
      version = '0.0.0', 
      scope = 'StillwaterSuite', 
      type = 'full',
      includeStorage = true,
      onProgress,
      signal,
      appIds,
      releaseId: customReleaseId,
      name: routineName
    } = options;

    const startTime = Date.now();
    const backupId = customReleaseId || this.generateBackupId();
    
    if (signal?.aborted) {
      console.log(`[Backup] Aborted before start: ${backupId}`);
      throw new Error('Backup cancelled');
    }

    // Determine what to backup based on type and explicit flags
    const shouldBackupDB = type === 'full' || type === 'database';
    const shouldBackupStorage = type === 'storage' || (type === 'full' && includeStorage);

    const appsToBackup = shouldBackupDB
      ? (appIds && appIds.length > 0 
          ? APPS_REGISTRY.filter(a => appIds.some(id => id.toLowerCase() === a.id.toLowerCase()))
          : APPS_REGISTRY)
      : [];

    this.currentSignal = signal;

    const localSetDir = path.join(this.localBackupRoot, backupId);
    await fs.ensureDir(localSetDir);

    const startMsg = `🚀 Initializing ${type} backup: ${backupId}`;
    console.log(startMsg);
    onProgress?.({ step: 'db', message: startMsg });
    
    operationMonitor.updateOperation(backupId, { 
      type: 'backup', 
      message: startMsg, 
      progress: 5,
      metadata: { 
        scope, 
        name: routineName,
        appIds: appsToBackup.map(a => a.id), 
        version, 
        includeStorage: shouldBackupStorage, 
        backupType: type 
      }
    }, controller);

    try {
      // 1. Individual App DB Backups
      if (shouldBackupDB && appsToBackup.length > 0) {
        const dbDir = path.join(localSetDir, 'databases');
        await fs.ensureDir(dbDir);
        
        for (let i = 0; i < appsToBackup.length; i++) {
          if (options.signal?.aborted) throw new Error('Backup cancelled');
          const app = appsToBackup[i];
          const msg = `Backing up ${app.id} Firestore...`;
          const percent = Math.round((i / appsToBackup.length) * 40) + 5;
          
          onProgress?.({ step: 'db', message: msg, appId: app.id, percent });
          operationMonitor.updateOperation(backupId, { message: msg, progress: percent });
          await this.backupAppDatabase(app, dbDir);
        }
      }

      // 2. Global Storage Backup
      let storageStatus: 'success' | 'failed' | 'skipped' = 'skipped';
      if (shouldBackupStorage) {
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        onProgress?.({ step: 'storage', message: 'Starting Storage backup...', percent: 45 });
        operationMonitor.updateOperation(backupId, { message: 'Archiving Cloud Storage...', progress: 45 });
        const success = await this.backupGlobalStorage(localSetDir, (p) => {
          onProgress?.(p);
          if (p.percent) operationMonitor.updateOperation(backupId, { progress: 45 + (p.percent * 0.3) });
        });
        storageStatus = success ? 'success' : 'failed';
      }

      // 3. Zip and Sync to Cloud
      const zipName = `${backupId}.zip`;
      const zipPath = path.join(this.localBackupRoot, zipName);
      
      const zipMsg = `📦 Zipping entire backup set...`;
      onProgress?.({ step: 'zip', message: zipMsg, percent: 80 });
      operationMonitor.updateOperation(backupId, { message: zipMsg, progress: 80 });
      await this.zipDirectory(localSetDir, zipPath, this.currentSignal);
      
      const checksumMsg = `🛡️ Generating SHA-256 integrity checksum...`;
      onProgress?.({ step: 'zip', message: checksumMsg, percent: 85 });
      const checksum = await this.calculateChecksum(zipPath);
      await fs.writeFile(`${zipPath}.sha256`, checksum);

      const stats = await fs.stat(zipPath);
      const totalSize = stats.size;

      const cloudMsg = `☁️ Syncing to Cloud Storage...`;
      if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
      onProgress?.({ step: 'cloud', message: cloudMsg, percent: 90 });
      operationMonitor.updateOperation(backupId, { message: cloudMsg, progress: 90 });
      
      const cloudDest = `AppSuite/backups/${backupId}/${zipName}`;
      
      let metadata: BackupMetadata;
      
      try {
        let uploadedSize = 0;
        const syncStartTime = Date.now();
        
        const zipStream = fs.createReadStream(zipPath);
        
        // Simple progress tracking through data events
        zipStream.on('data', (chunk) => {
          uploadedSize += chunk.length;
          const elapsed = (Date.now() - syncStartTime) / 1000; // seconds
          const speed = uploadedSize / elapsed; // bytes/sec
          const remaining = totalSize - uploadedSize;
          const eta = speed > 0 ? Math.round(remaining / speed) : 0;
          
          const percent = 90 + Math.floor((uploadedSize / totalSize) * 9);
          onProgress?.({ 
            step: 'cloud', 
            message: `☁️ Syncing to Cloud Storage (${(uploadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)...`, 
            percent,
            metrics: {
              totalSize,
              transferredSize: uploadedSize,
              elapsed,
              eta,
              speed
            }
          });
        });

        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        await this.storageProvider.upload(zipStream, cloudDest, 'application/zip', this.currentSignal || undefined);
        
        // Upload checksum
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        await this.storageProvider.upload(Buffer.from(checksum), `${cloudDest}.sha256`, 'text/plain', this.currentSignal || undefined);

        // 4. Save Metadata (Hybrid)
        const durationMs = Date.now() - startTime;
        metadata = {
          id: backupId,
          name: routineName || backupId,
          type,
          scope,
          version,
          apps: appsToBackup.map(a => a.id),
          includeStorage: shouldBackupStorage,
          timestamp: Date.now(),
          dateStr: new Date().toISOString(),
          checksum,
          stats: {
            totalSize,
            durationMs,
          },
          trigger: {
            type: version === 'auto-sched' ? 'scheduled' : 'manual',
          },
          storageStatus,
          fullPath: `AppSuite/backups/${backupId}/`
        };

        // GCS Sidecar
        await this.storageProvider.upload(JSON.stringify(metadata, null, 2), `AppSuite/backups/${backupId}/metadata.json`, 'application/json');

        // Firestore Registry
        const db = getFirestore(this.firebaseApp);
        await db.collection('backups').doc(backupId).set({ ...metadata, status: 'active' });

      } catch (syncErr: any) {
        const syncFailMsg = `🚨 CLOUD SYNC FAILURE: Backup created locally but failed to upload to Cloud Storage. Error: ${syncErr.message}`;
        console.error(syncFailMsg);
        
        await notificationManager.send({
          title: 'Backup Sync Failed',
          message: syncFailMsg,
          type: 'failure',
          appId: 'StillwaterSuite',
          details: syncErr.message
        });

        await auditLogger.log({
          type: 'backup',
          action: 'Cloud Sync Failure',
          status: 'failure',
          details: syncFailMsg,
          appId: 'StillwaterSuite'
        });

        throw new Error(syncFailMsg);
      }


      const completeMsg = `✅ Backup complete and synced to: ${cloudDest}`;
      onProgress?.({ step: 'complete', message: completeMsg, percent: 100 });
      operationMonitor.updateOperation(backupId, { status: 'completed', message: 'Backup Finished', progress: 100 });
      
      await auditLogger.log({
        type: 'backup',
        action: `${backupId}.zip`,
        status: 'success',
        details: `Created snapshot: ${backupId} (Checksum: ${checksum.slice(0, 8)}...). Apps: ${appsToBackup.map(a => a.id).join(', ')}`,
        appId: 'StillwaterSuite'
      });

      return { backupId, cloudDest, localPath: zipPath, timestamp: metadata.timestamp, checksum };

    } catch (err: any) {
      console.error(`[Backup] Orchestrator error for ${backupId}:`, err);
      
      // Cleanup local artifacts on failure/cancellation
      try {
        if (await fs.pathExists(localSetDir)) {
          console.log(`[Backup] Cleaning up local directory: ${localSetDir}`);
          await fs.remove(localSetDir);
        }
        const zipPath = path.join(this.localBackupRoot, `${backupId}.zip`);
        if (await fs.pathExists(zipPath)) {
          console.log(`[Backup] Cleaning up local zip: ${zipPath}`);
          await fs.remove(zipPath);
        }
      } catch (cleanupErr) {
        console.error('[Backup] Failed to clean up local artifacts:', cleanupErr);
      }

      const status = err.message === 'Backup cancelled' ? 'failed' : 'failed';
      operationMonitor.updateOperation(backupId, { 
        status: 'failed', 
        message: err.message === 'Backup cancelled' ? 'Cancelled by user' : `Error: ${err.message}` 
      });
      throw err;
    }
  }

  private async backupAppDatabase(app: AppRecord, parentDir: string) {
    const db = getFirestore(this.firebaseApp, app.dbId);
    const appDir = path.join(parentDir, app.id);
    await fs.ensureDir(appDir);

    console.log(`  - [${app.id}] Backing up Firestore (${app.dbId})...`);
    try {
      const collections = await db.listCollections();
      if (collections.length === 0) {
        console.log(`    ⚠️ No collections found for ${app.id}.`);
        return;
      }

      for (const collection of collections) {
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        const data = await this.exportCollection(collection);
        await fs.writeJson(path.join(appDir, `${collection.id}.json`), data, { spaces: 2 });
      }
    } catch (err: any) {
      if (err.message === 'Backup cancelled') throw err;
      console.error(`    ❌ FAILED to backup ${app.id}: ${err.message}`);
    }
  }

  private async exportCollection(collection: any): Promise<any> {
    const snapshot = await collection.get();
    const data: Record<string, any> = {};

    for (const doc of snapshot.docs) {
      if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
      data[doc.id] = doc.data();
      
      // Check for subcollections
      const subcollections = await doc.ref.listCollections();
      if (subcollections.length > 0) {
        data[doc.id]._subcollections = {};
        for (const subcol of subcollections) {
          if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
          data[doc.id]._subcollections[subcol.id] = await this.exportCollection(subcol);
        }
      }
    }
    return data;
  }

  private async getActiveAssetIds(): Promise<{ projectIds: Set<string>; userIds: Set<string> }> {
    const db = getFirestore(this.firebaseApp);
    const projectIds = new Set<string>();
    const userIds = new Set<string>();

    try {
      // Fetch all active projects
      const projectSnap = await db.collection('projects').get();
      projectSnap.forEach(doc => projectIds.add(doc.id));

      // Fetch all users
      const userSnap = await db.collection('users').get();
      userSnap.forEach(doc => userIds.add(doc.id));

      console.log(`  - [Filter] Resolved ${projectIds.size} active projects and ${userIds.size} active users.`);
    } catch (err) {
      console.error('  - [Filter] FAILED to resolve active asset IDs, falling back to permissive mode:', err);
    }

    return { projectIds, userIds };
  }

  private async backupGlobalStorage(targetDir: string, onProgress?: (p: BackupProgressEvent) => void): Promise<boolean> {
    const bucketName = `${this.projectId}.firebasestorage.app`;
    const bucket = getStorage(this.firebaseApp).bucket(bucketName);
    const storageDir = path.join(targetDir, 'storage');
    await fs.ensureDir(storageDir);

    console.log(`  - [Storage] Backing up bucket: ${bucketName} (Surgical Sync Enabled)...`);
    
    try {
      const { projectIds, userIds } = await this.getActiveAssetIds();
      
      const [allFiles] = await bucket.getFiles();
      
      // Filter files based on whitelist and active IDs
      const files = allFiles.filter(file => {
        const parts = file.name.split('/');
        const rootDir = parts[0];
        
        // 1. Direct Whitelist
        if (this.WHITELISTED_ROOT_DIRS.includes(rootDir)) return true;
        
        // 2. Active Projects Filter
        if (rootDir === 'projects' && parts.length > 1) {
          return projectIds.has(parts[1]);
        }
        
        // 3. Active Users Filter
        if (rootDir === 'users' && parts.length > 1) {
          return userIds.has(parts[1]);
        }
        
        return false;
      });

      const totalFiles = files.length;
      const skippedCount = allFiles.length - totalFiles;
      
      console.log(`    └─ Whitelist applied: Processing ${totalFiles} required files (Pruned ${skippedCount} orphaned/ephemeral items)`);
      
      if (totalFiles === 0) {
        console.log('    └─ No required assets found in bucket.');
        return true;
      }

      const BATCH_SIZE = 50;
      for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (file) => {
          // Skip directories/placeholders
          if (file.name.endsWith('/')) return;

          const destPath = path.join(storageDir, file.name);
          const destDir = path.dirname(destPath);
          await fs.ensureDir(destDir);
          await file.download({ destination: destPath });
        }));

        onProgress?.({ 
          step: 'storage', 
          message: `Downloaded ${Math.min(i + BATCH_SIZE, totalFiles)}/${totalFiles} files...`,
          percent: Math.round(((i + BATCH_SIZE) / totalFiles) * 100)
        });
      }
    } catch (err: any) {
      console.error(`    ❌ FAILED to backup Storage: ${err.message}`);
      onProgress?.({ step: 'error', message: `Storage backup failed: ${err.message}` });
      return false;
    }
    return true;
  }

  private async zipDirectory(sourceDir: string, outPath: string, signal?: AbortSignal): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);

    return new Promise((resolve, reject) => {
      let isAborted = false;

      const onAbort = () => {
        isAborted = true;
        console.log('[Backup] Zipping aborted, cleaning up...');
        archive.destroy();
        stream.destroy();
        
        // Clean up partial file
        fs.unlink(outPath).catch(() => {});
        
        reject(new Error('Backup cancelled'));
      };

      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort);

      stream.on('error', err => {
        if (isAborted) return;
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      });

      archive
        .directory(sourceDir, false)
        .on('error', err => {
          if (isAborted) return;
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        })
        .pipe(stream);

      stream.on('close', () => {
        if (isAborted) return;
        signal?.removeEventListener('abort', onAbort);
        resolve();
      });
      
      archive.finalize();
    });
  }

  async archiveBackup(id: string) {
    const db = getFirestore(this.firebaseApp);
    const doc = await db.collection('backups').doc(id).get();
    if (!doc.exists) throw new Error(`Backup ${id} not found in registry`);
    
    const data = doc.data()!;
    const src = data.fullPath;
    if (!src) throw new Error(`Backup ${id} has no fullPath`);

    const dest = `AppSuite/archive/${id}`;
    await this.storageProvider.move(src, dest);
    
    await db.collection('backups').doc(id).update({ 
      status: 'archived',
      fullPath: `${dest}/`
    });
  }

  async unarchiveBackup(id: string) {
    const db = getFirestore(this.firebaseApp);
    const doc = await db.collection('backups').doc(id).get();
    if (!doc.exists) throw new Error(`Backup ${id} not found in registry`);
    
    const data = doc.data()!;
    const src = data.fullPath;
    if (!src) throw new Error(`Backup ${id} has no fullPath`);

    const dest = `AppSuite/backups/${id}`;
    await this.storageProvider.move(src, dest);
    
    await db.collection('backups').doc(id).update({ 
      status: 'active',
      fullPath: `${dest}/`
    });
  }
}
