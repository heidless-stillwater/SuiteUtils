import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Using the identified source service account for heidless-apps-2
const serviceAccount = JSON.parse(fs.readFileSync('./scratch/service-account-target.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function findUserInApps2(email: string) {
  console.log(`🛰️ Searching for user in HEIDLESS-APPS-2: ${email}...`);
  
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`✅ Found User UID in Apps-2: ${uid}`);

    // Check prompttool-db-0
    const db = getFirestore(admin.app(), 'prompttool-db-0');
    const imagesRef = db.collection('users').doc(uid).collection('images');
    const snapshot = await imagesRef.get();
    
    console.log(`📊 Total images found in HEIDLESS-APPS-2: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      console.log('🖼️ Sample Image Prompt:', snapshot.docs[0].data().prompt);
    }
  } catch (error) {
    console.error('❌ Error in Apps-2 check:', error);
  }
}

const targetEmail = 'heidlessemail18@gmail.com';
findUserInApps2(targetEmail).catch(console.error);
