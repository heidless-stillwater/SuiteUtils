import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkUserGallery(email: string) {
  console.log(`🛰️ Searching for user: ${email}...`);
  
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`✅ Found User UID: ${uid}`);

    const databases = ['prompttool-db-0', 'suiteutils-db-0'];
    
    for (const dbId of databases) {
      console.log(`\n🔍 Checking Database: ${dbId}...`);
      const db = getFirestore(admin.app(), dbId);
      
      // Check images collection
      const imagesRef = db.collection('users').doc(uid).collection('images');
      const snapshot = await imagesRef.limit(10).get();
      
      console.log(`📊 Image Count (approx): ${snapshot.size}${snapshot.size === 10 ? '+' : ''}`);
      
      if (snapshot.size > 0) {
        console.log('🖼️ Sample Image Prompt:', snapshot.docs[0].data().prompt);
      } else {
        console.log('❌ No images found in this database for this user.');
      }
    }
  } catch (error) {
    console.error('❌ Error checking gallery:', error);
  }
}

const targetEmail = 'heidlessemail18@gmail.com';
checkUserGallery(targetEmail).catch(console.error);
