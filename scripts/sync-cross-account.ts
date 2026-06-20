import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);

const sourceEmailIndex = args.indexOf('--source-email');
const sourceEmail = sourceEmailIndex !== -1 && args[sourceEmailIndex + 1] ? args[sourceEmailIndex + 1] : 'heidlessemail19@gmail.com';

const targetEmailIndex = args.indexOf('--target-email');
const targetEmail = targetEmailIndex !== -1 && args[targetEmailIndex + 1] ? args[targetEmailIndex + 1] : 'heidlessemail21@gmail.com';

const commitMode = args.includes('--commit');

const sourceKeyPath = './secrets/heidless-apps-2-firebase-adminsdk-fbsvc-fea3de0c63.json';
const targetKeyPath = './suite-admin-sovereign.json';

async function runSync() {
  console.log('🏰 ==================================================== 🏰');
  console.log('🛰️   SOVEREIGN CROSS-ACCOUNT SYNCHRONIZER PROTOCOL (v1.0)');
  console.log('🏰 ==================================================== 🏰');
  console.log(`👤 Source User Email: ${sourceEmail}`);
  console.log(`👤 Target User Email: ${targetEmail}`);
  console.log(`⚙️  Execution Mode:   ${commitMode ? '🔥 COMMIT & WRITE' : '🔍 DRY-RUN ONLY'}`);
  console.log('----------------------------------------------------------');

  // Verify paths
  if (!fs.existsSync(sourceKeyPath)) {
    throw new Error(`Source credentials file missing at: ${sourceKeyPath}`);
  }
  if (!fs.existsSync(targetKeyPath)) {
    throw new Error(`Target credentials file missing at: ${targetKeyPath}`);
  }

  const sourceAccount = JSON.parse(fs.readFileSync(sourceKeyPath, 'utf8'));
  const targetAccount = JSON.parse(fs.readFileSync(targetKeyPath, 'utf8'));

  const sourceProject = sourceAccount.project_id;
  const targetProject = targetAccount.project_id;

  const sourceBucketName = 'heidless-apps-2.firebasestorage.app';
  const targetBucketName = 'stillwater-sovereign-01.firebasestorage.app';

  console.log(`📥 Source Project: ${sourceProject} (${sourceBucketName})`);
  console.log(`📤 Target Project: ${targetProject} (${targetBucketName})`);
  console.log('----------------------------------------------------------');

  // Initialize Source App
  console.log('🔌 Connecting to Source Firebase App...');
  const sourceApp = admin.initializeApp({
    credential: admin.credential.cert(sourceAccount),
    storageBucket: sourceBucketName
  }, 'global_source');

  // Initialize Target App
  console.log('🔌 Connecting to Target Firebase App...');
  const targetApp = admin.initializeApp({
    credential: admin.credential.cert(targetAccount),
    storageBucket: targetBucketName
  }, 'global_target');

  const sourceDb = getFirestore(sourceApp, 'prompttool-db-0');
  const targetDb = getFirestore(targetApp, 'prompttool-db-0');

  const sourceBucket = getStorage(sourceApp).bucket();
  const targetBucket = getStorage(targetApp).bucket();

  // Resolve user UIDs
  console.log('\n🔍 Resolving User UIDs via Firebase Authentication...');
  let sourceUid = '';
  let targetUid = '';

  try {
    const sourceUser = await sourceApp.auth().getUserByEmail(sourceEmail);
    sourceUid = sourceUser.uid;
    console.log(`✅ Source UID (Remote): ${sourceUid}`);
  } catch (err: any) {
    console.error(`❌ User not found in remote Auth database: ${err.message}`);
    process.exit(1);
  }

  try {
    const targetUser = await targetApp.auth().getUserByEmail(targetEmail);
    targetUid = targetUser.uid;
    console.log(`✅ Target UID (Local):  ${targetUid}`);
  } catch (err: any) {
    console.error(`❌ User not found in local Auth database: ${err.message}`);
    process.exit(1);
  }

  // Fetch Firestore variations documents
  console.log('\n📊 Fetching Firestore documents in prompttool-db-0 [collection: users/{uid}/images]...');
  const sourceImagesRef = sourceDb.collection('users').doc(sourceUid).collection('images');
  const targetImagesRef = targetDb.collection('users').doc(targetUid).collection('images');

  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    sourceImagesRef.get(),
    targetImagesRef.get()
  ]);

  console.log(`📁 Source variation documents: ${sourceSnapshot.size}`);
  console.log(`📁 Target variation documents: ${targetSnapshot.size}`);

  const targetDocsMap = new Map<string, admin.firestore.DocumentData>();
  targetSnapshot.docs.forEach(doc => {
    targetDocsMap.set(doc.id, doc.data());
  });

  const missingFirestoreDocs: { id: string; data: any }[] = [];
  const missingStorageFiles: {
    sourcePath: string;
    targetPath: string;
    contentType?: string;
    imageId: string;
    title: string;
  }[] = [];

  console.log('\n🔍 Auditing variations and checking storage sync status...');

  const BATCH_SIZE = 30;
  const docsArray = sourceSnapshot.docs;
  for (let i = 0; i < docsArray.length; i += BATCH_SIZE) {
    const batchDocs = docsArray.slice(i, i + BATCH_SIZE);
    await Promise.all(batchDocs.map(async (srcDoc) => {
      const srcData = srcDoc.data();
      const docId = srcDoc.id;
      const title = srcData.title || srcData.prompt?.substring(0, 30) || 'Untitled Variation';

      // 1. Check if Document exists in Target Firestore
      const hasTargetDoc = targetDocsMap.has(docId);
      if (!hasTargetDoc) {
        console.log(`📌 [Firestore Delta] Document missing in target: "${title}" (ID: ${docId})`);
        missingFirestoreDocs.push({ id: docId, data: srcData });
      }

      // 2. Resolve storage path
      const rawStoragePath = srcData.storagePath || srcData.imageUrl?.split('/o/')[1]?.split('?')[0] || '';
      if (!rawStoragePath) {
        return;
      }

      const decodedStoragePath = decodeURIComponent(rawStoragePath);
      // Translate the path for target user
      const targetStoragePath = decodedStoragePath.replace(sourceUid, targetUid);

      // 3. Verify file presence in target Storage bucket
      const targetFile = targetBucket.file(targetStoragePath);
      const [existsLocal] = await targetFile.exists();

      if (!existsLocal) {
        // Verify if the file actually exists in the source Storage bucket to pull
        const sourceFile = sourceBucket.file(decodedStoragePath);
        const [existsRemote] = await sourceFile.exists();

        if (existsRemote) {
          console.log(`🖼️  [Storage Delta] File missing locally: "${title}" -> ${targetStoragePath}`);
          // Fetch metadata to check content type if available
          let contentType = 'image/png';
          try {
            const [metadata] = await sourceFile.getMetadata();
            contentType = metadata.contentType || 'image/png';
          } catch {}

          missingStorageFiles.push({
            sourcePath: decodedStoragePath,
            targetPath: targetStoragePath,
            contentType,
            imageId: docId,
            title
          });
        } else {
          console.log(`⚠️  [Orphaned Link] File missing on BOTH remote and local Storage for: "${title}"`);
        }
      }
    }));
  }

  console.log('\n==========================================================');
  console.log('📊 SYNCHRONIZATION MANIFEST SUMMARY');
  console.log('==========================================================');
  console.log(`📝 Firestore Documents to Sync: ${missingFirestoreDocs.length}`);
  console.log(`📦 Storage Files to pulling:    ${missingStorageFiles.length}`);
  console.log('==========================================================');

  if (missingFirestoreDocs.length === 0 && missingStorageFiles.length === 0) {
    console.log('✨ SUCCESS: Account is fully synchronized. No differences found!');
    process.exit(0);
  }

  if (!commitMode) {
    console.log('\n💡 Dry-Run Complete. No modifications were written.');
    console.log('🚀 Run the script with the `--commit` flag to synchronize all changes:');
    console.log(`   npx tsx scripts/sync-cross-account.ts --source-email ${sourceEmail} --target-email ${targetEmail} --commit`);
    process.exit(0);
  }

  // --- WRITE TRANSACTION SEQUENCE ---
  console.log('\n🚀 Starting Sync Replication Protocol...');

  // 1. Sync Storage Objects
  if (missingStorageFiles.length > 0) {
    console.log(`\n📦 Pulling ${missingStorageFiles.length} Storage files from remote bucket...`);
    let fileCount = 0;
    const STORAGE_BATCH_SIZE = 15;
    for (let i = 0; i < missingStorageFiles.length; i += STORAGE_BATCH_SIZE) {
      const batch = missingStorageFiles.slice(i, i + STORAGE_BATCH_SIZE);
      await Promise.all(batch.map(async (fileToSync) => {
        try {
          console.log(`   🔄 Downloading "${fileToSync.title}"...`);
          const sourceFileRef = sourceBucket.file(fileToSync.sourcePath);
          const [buffer] = await sourceFileRef.download();

          console.log(`   📤 Uploading to local bucket at: ${fileToSync.targetPath}`);
          const targetFileRef = targetBucket.file(fileToSync.targetPath);
          await targetFileRef.save(buffer, {
            metadata: { contentType: fileToSync.contentType || 'image/png' }
          });
          
          await targetFileRef.makePublic();
          console.log(`   ✅ Synced: "${fileToSync.title}"`);
          fileCount++;
        } catch (err: any) {
          console.error(`   ❌ Failed to sync Storage file for "${fileToSync.title}": ${err.message}`);
        }
      }));
    }
    console.log(`\n🏁 Storage Pulling complete. Successfully replicated ${fileCount} files.`);
  }

  // 2. Sync Firestore Documents
  if (missingFirestoreDocs.length > 0) {
    console.log(`\n📝 Inserting ${missingFirestoreDocs.length} Firestore documents into local target...`);
    const batch = targetDb.batch();

    missingFirestoreDocs.forEach(item => {
      const data = item.data;
      
      // Perform path and URL translates
      const translateString = (str: any) => {
        if (typeof str !== 'string') return str;
        return str
          .replace(new RegExp(sourceUid, 'g'), targetUid)
          .replace(new RegExp(sourceBucketName, 'g'), targetBucketName);
      };

      const translatedSettings = data.settings ? { ...data.settings } : {};
      if (translatedSettings.storagePath) {
        translatedSettings.storagePath = translateString(translatedSettings.storagePath);
      }

      const migratedData = {
        ...data,
        userId: targetUid,
        imageUrl: translateString(data.imageUrl),
        storagePath: translateString(data.storagePath),
        videoUrl: translateString(data.videoUrl),
        settings: {
          ...translatedSettings,
          prompt: data.prompt
        },
        authorName: data.authorName || 'persona v1.0 (Restored via Sync)',
        syncTimestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      const targetDocRef = targetImagesRef.doc(item.id);
      batch.set(targetDocRef, migratedData, { merge: true });
      console.log(`   ➕ Enqueued Firestore document set for "${data.title || 'Untitled'}" (ID: ${item.id})`);
    });

    console.log('   🛰️  Committing Firestore batch transaction...');
    await batch.commit();
    console.log(`✅ Success! Synchronized ${missingFirestoreDocs.length} documents.`);
  }

  console.log('\n🎉 ==================================================== 🎉');
  console.log('🎯   CROSS-ACCOUNT SYNCHRONIZATION COMPLETELY SUCCESSFUL!');
  console.log('🎉 ==================================================== 🎉');
}

runSync().catch(err => {
  console.error('\n❌ CRITICAL SYNCHRONIZATION FAILURE:', err);
  process.exit(1);
});
