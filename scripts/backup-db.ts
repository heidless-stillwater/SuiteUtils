import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

// Define configuration
const PROJECT_ID = 'heidless-apps-0';
const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`; // Default Firebase Storage bucket
const BACKUPS_DIR = path.join(process.cwd(), 'BACKUPS');

// Dynamic list based on Stillwater App Suite Registry
const APPS_TO_BACKUP = [
  { name: 'ag-video-system', dbId: 'autovideo-db-0' },
  { name: 'PromptTool', dbId: 'prompttool-db-0' },
  { name: 'PromptResources', dbId: 'promptresources-db-0' },
  { name: 'PromptMasterSPA', dbId: 'promptmaster-spa-db-0' },
  { name: 'PromptAccreditation', dbId: 'promptaccreditation-db-0' },
  { name: 'PlanTune', dbId: 'plantune-db-0' },
  { name: 'SuiteUtils', dbId: 'suiteutils-db-0' }
];

/**
 * Formats a date to YYYY-MM-DD_HH-mm-ss
 */
function getTimestampString(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mins = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${mins}-${ss}`;
}

async function exportSubcollection(subcollectionRef: any): Promise<Record<string, any>> {
  const snapshot = await subcollectionRef.get();
  const data: Record<string, any> = {};

  for (const doc of snapshot.docs) {
    data[doc.id] = doc.data();
    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      data[doc.id]._subcollections = {};
      for (const subcol of subcollections) {
        data[doc.id]._subcollections[subcol.id] = await exportSubcollection(subcol);
      }
    }
  }
  return data;
}

async function exportCollection(db: any, collectionName: string, backupPath: string) {
  console.log(`    └─ Exporting collection: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const data: Record<string, any> = {};

  for (const doc of snapshot.docs) {
    data[doc.id] = doc.data();
    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      data[doc.id]._subcollections = {};
      for (const subcol of subcollections) {
        data[doc.id]._subcollections[subcol.id] = await exportSubcollection(subcol);
      }
    }
  }

  const filePath = path.join(backupPath, `${collectionName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function backupApp(appName: string, dbId: string, backupSetDir: string) {
  console.log(`\n📦 [${appName}] Database: ${dbId}`);
  
  const appDir = path.join(backupSetDir, appName);
  fs.mkdirSync(appDir);

  const app = getApps().length === 0 
    ? initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET })
    : getApps()[0];
  
  const db = getFirestore(app, dbId);

  try {
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log(`    ⚠️ No collections found.`);
      return;
    }

    for (const collection of collections) {
      await exportCollection(db, collection.id, appDir);
    }
    
    console.log(`    ✅ Successfully backed up ${appName} DB.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    ❌ FAILED to backup ${appName}: ${msg}`);
  }
}

async function backupStorage(backupSetDir: string) {
  console.log(`\n☁️  [Storage] Target Bucket: ${STORAGE_BUCKET}`);
  
  const storageDir = path.join(backupSetDir, 'storage');
  fs.mkdirSync(storageDir);

  const app = getApps().length === 0 
    ? initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET })
    : getApps()[0];

  const bucket = getStorage(app).bucket();

  try {
    const [files] = await bucket.getFiles();
    console.log(`    └─ Downloading ${files.length} files...`);

    // Download files in batches to avoid overwhelming the system
    const BATCH_SIZE = 50;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (file) => {
        const destPath = path.join(storageDir, file.name);
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        await file.download({ destination: destPath });
      }));
      console.log(`    └─ Progress: ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files...`);
    }
    
    console.log(`    ✅ Successfully backed up entire Storage container.`);
  } catch (err) {
    console.error(`    ❌ FAILED to backup Storage: ${err}`);
  }
}

async function runGlobalHybridBackup() {
  const startTime = Date.now();
  console.log(`============================================================`);
  console.log(`🚀 STILLWATER GLOBAL HYBRID BACKUP (ALL DBs + STORAGE)`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`============================================================`);
  
  const timestamp = getTimestampString();
  const backupSetDir = path.join(BACKUPS_DIR, timestamp);
  
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR);
  }
  fs.mkdirSync(backupSetDir);
  
  console.log(`Backup Set: ${timestamp}`);
  console.log(`Destination: ${backupSetDir}`);

  // 1. Storage Backup
  await backupStorage(backupSetDir);

  // 2. Database Backups for all apps
  for (const app of APPS_TO_BACKUP) {
    await backupApp(app.name, app.dbId, backupSetDir);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n============================================================`);
  console.log(`✨ GLOBAL HYBRID BACKUP COMPLETE in ${duration}s! ✨`);
  console.log(`Location: ${backupSetDir}`);
  console.log(`============================================================`);
}

runGlobalHybridBackup().catch((error) => {
  console.error('Global backup failed:', error);
  process.exit(1);
});
