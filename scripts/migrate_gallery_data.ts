import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function migrateGalleryData() {
  const sourceUid = '6W6SvLUqb4asm2UmsVRZ6CakgVh2'; // heidlessemail17
  const targetUid = 'AHYxlW1bIibW4LZl3LoHPbGUUaz2'; // heidlessemail18
  const dbId = 'prompttool-db-0';

  console.log(`🛰️ Starting Migration: ${sourceUid} ➔ ${targetUid} in ${dbId}...`);

  try {
    const db = getFirestore(admin.app(), dbId);
    
    // Fetch all images from source
    const sourceImagesRef = db.collection('users').doc(sourceUid).collection('images');
    const snapshot = await sourceImagesRef.get();
    
    console.log(`📊 Found ${snapshot.size} images to migrate.`);
    
    const batch = db.batch();
    const targetImagesRef = db.collection('users').doc(targetUid).collection('images');

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Update pointer fields
      const migratedData = {
        ...data,
        userId: targetUid,
        authorName: 'Arjuna (Restored)', // Tagging as restored
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const newDocRef = targetImagesRef.doc(doc.id);
      batch.set(newDocRef, migratedData);
    });

    console.log('🛰️ Committing batch migration...');
    await batch.commit();
    console.log(`✅ Success! Migrated ${snapshot.size} images to ${targetUid}.`);

  } catch (error) {
    console.error('❌ Migration Failed:', error);
  }
}

migrateGalleryData().catch(console.error);
