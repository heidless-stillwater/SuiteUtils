import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function scanForImages() {
  console.log('🛰️ Scanning for images across all users in prompttool-db-0...');
  
  try {
    const db = getFirestore(admin.app(), 'prompttool-db-0');
    
    // Use collectionGroup to find all 'images' subcollections
    const imagesGroup = db.collectionGroup('images');
    const snapshot = await imagesGroup.limit(5).get();
    
    console.log(`📊 Total images found in scan: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      snapshot.docs.forEach(doc => {
        console.log(`--- Image ID: ${doc.id} ---`);
        console.log(`Path: ${doc.ref.path}`);
        console.log(`User ID (from path): ${doc.ref.path.split('/')[1]}`);
        console.log(`Data Sample: ${JSON.stringify(doc.data()).substring(0, 100)}...`);
      });
    } else {
      console.log('❌ No images found in prompttool-db-0 collection group.');
    }
  } catch (error) {
    console.error('❌ Error scanning images:', error);
  }
}

scanForImages().catch(console.error);
