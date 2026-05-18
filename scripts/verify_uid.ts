import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function verifyOldUid(uid: string) {
  console.log(`🛰️ Verifying Identity for UID: ${uid}...`);
  
  try {
    const userRecord = await admin.auth().getUser(uid);
    console.log(`✅ Found User: ${userRecord.email}`);
    console.log(`Creation Time: ${userRecord.metadata.creationTime}`);
  } catch (error) {
    console.error('❌ User not found in Auth for this UID.');
  }
}

const oldUid = '6W6SvLUqb4asm2UmsVRZ6CakgVh2';
verifyOldUid(oldUid).catch(console.error);
