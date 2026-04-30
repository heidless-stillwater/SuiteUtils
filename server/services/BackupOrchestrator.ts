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
  includeStorage?: boolean;
  onProgress?: (event: BackupProgressEvent) => void;
  signal?: AbortSignal;
  appIds?: string[];
  releaseId?: string;
}

export type BackupProgressEvent = {
  step: 'db' | 'storage' | 'zip' | 'cloud' | 'complete' | 'error';
  message: string;
  appId?: string;
  percent?: number;
};

export class BackupOrchestrator {
  private firebaseApp: App;
  private storageProvider: IStorageProvider;
  private projectId: string;
  private localBackupRoot: string;
  private currentSignal?: AbortSignal;

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

  /**
   * Main entry point for a full suite backup
   */
  async runFullSuiteBackup(options: BackupOptions = {}, controller?: AbortController) {
    const { 
      version = '0.0.0', 
      scope = 'StillwaterSuite', 
      includeStorage = true,
      onProgress,
      signal,
      appIds,
      releaseId: customReleaseId
    } = options;

    const appsToBackup = appIds && appIds.length > 0 
      ? APPS_REGISTRY.filter(a => appIds.some(id => id.toLowerCase() === a.id.toLowerCase()))
      : APPS_REGISTRY;

    this.currentSignal = signal;

    const now = new Date();
    const timestamp = now.getTime();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
    const msPart = now.getMilliseconds().toString().padStart(3, '0');
    const releaseId = customReleaseId || `${scope}_v${version}_${datePart}_${timePart}_${msPart}`;
    const localSetDir = path.join(this.localBackupRoot, releaseId);
    
    await fs.ensureDir(localSetDir);
    const startMsg = `🚀 Initializing: ${releaseId}`;
    console.log(startMsg);
    onProgress?.({ step: 'db', message: startMsg });
    operationMonitor.updateOperation(releaseId, { 
      type: 'backup', 
      message: startMsg, 
      progress: 5,
      metadata: { scope, appIds: appsToBackup.map(a => a.id), version, includeStorage }
    }, controller);

    try {
      // 1. Individual App DB Backups
      const dbDir = path.join(localSetDir, 'databases');
      await fs.ensureDir(dbDir);
      
      for (let i = 0; i < appsToBackup.length; i++) {
        if (options.signal?.aborted) throw new Error('Backup cancelled');
        const app = appsToBackup[i];
        const msg = `Backing up ${app.id} Firestore...`;
        const percent = Math.round((i / appsToBackup.length) * 40) + 5;
        
        onProgress?.({ step: 'db', message: msg, appId: app.id, percent });
        operationMonitor.updateOperation(releaseId, { message: msg, progress: percent });
        await this.backupAppDatabase(app, dbDir);
      }

      // 2. Global Storage Backup
      if (includeStorage) {
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        onProgress?.({ step: 'storage', message: 'Starting Storage backup...', percent: 45 });
        operationMonitor.updateOperation(releaseId, { message: 'Archiving Cloud Storage...', progress: 45 });
        await this.backupGlobalStorage(localSetDir, (p) => {
          onProgress?.(p);
          if (p.percent) operationMonitor.updateOperation(releaseId, { progress: 45 + (p.percent * 0.3) });
        });
      }

      // 3. Zip and Sync to Cloud
      const zipName = `${releaseId}.zip`;
      const zipPath = path.join(this.localBackupRoot, zipName);
      
      const zipMsg = `📦 Zipping entire backup set...`;
      onProgress?.({ step: 'zip', message: zipMsg, percent: 80 });
      operationMonitor.updateOperation(releaseId, { message: zipMsg, progress: 80 });
      await this.zipDirectory(localSetDir, zipPath, this.currentSignal);
      
      const checksumMsg = `🛡️ Generating SHA-256 integrity checksum...`;
      onProgress?.({ step: 'zip', message: checksumMsg, percent: 85 });
      const checksum = await this.calculateChecksum(zipPath);
      await fs.writeFile(`${zipPath}.sha256`, checksum);

      const cloudMsg = `☁️ Syncing to Cloud Storage...`;
      if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
      onProgress?.({ step: 'cloud', message: cloudMsg, percent: 90 });
      operationMonitor.updateOperation(releaseId, { message: cloudMsg, progress: 90 });
      const cloudDest = `AppSuite/backups/${scope}/releases/v${version}/${releaseId}/${zipName}`;
      
      try {
        const zipBuffer = await fs.readFile(zipPath);
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        await this.storageProvider.upload(zipBuffer, cloudDest, 'application/zip', this.currentSignal || undefined);
        // Upload checksum too
        if (this.currentSignal?.aborted) throw new Error('Backup cancelled');
        await this.storageProvider.upload(Buffer.from(checksum), `${cloudDest}.sha256`, 'text/plain', this.currentSignal || undefined);
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
      operationMonitor.updateOperation(releaseId, { status: 'completed', message: 'Backup Finished', progress: 100 });
      
      await auditLogger.log({
        type: 'backup',
        action: `${releaseId}.zip`,
        status: 'success',
        details: `Created snapshot: ${releaseId} (Checksum: ${checksum.slice(0, 8)}...). Apps: ${appsToBackup.map(a => a.id).join(', ')}`,
        appId: 'StillwaterSuite'
      });

      return { releaseId, cloudDest, localPath: zipPath, timestamp, checksum };

    } catch (err: any) {
      console.error(`[Backup] Orchestrator error for ${releaseId}:`, err);
      
      // Cleanup local artifacts on failure/cancellation
      try {
        if (await fs.pathExists(localSetDir)) {
          console.log(`[Backup] Cleaning up local directory: ${localSetDir}`);
          await fs.remove(localSetDir);
        }
        const zipPath = path.join(this.localBackupRoot, `${releaseId}.zip`);
        if (await fs.pathExists(zipPath)) {
          console.log(`[Backup] Cleaning up local zip: ${zipPath}`);
          await fs.remove(zipPath);
        }
      } catch (cleanupErr) {
        console.error('[Backup] Failed to clean up local artifacts:', cleanupErr);
      }

      const status = err.message === 'Backup cancelled' ? 'failed' : 'failed';
      operationMonitor.updateOperation(releaseId, { 
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

  private async backupGlobalStorage(targetDir: string, onProgress?: (event: BackupProgressEvent) => void) {
    const bucketName = `${this.projectId}.firebasestorage.app`;
    const bucket = getStorage(this.firebaseApp).bucket(bucketName);
    const storageDir = path.join(targetDir, 'storage');
    await fs.ensureDir(storageDir);

    console.log(`  - [Storage] Backing up bucket: ${bucketName}...`);
    try {
      const [files] = await bucket.getFiles();
      const totalFiles = files.length;
      console.log(`    └─ Downloading ${totalFiles} files...`);

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
    }
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
}
