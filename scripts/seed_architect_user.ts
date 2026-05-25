import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./suite-admin-sovereign.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminApp = admin.app();

const UID = 'stqIDYHVcLRxjclsqaksiKMvSXz2';
const EMAIL = 'heidlessemail18@gmail.com';
const DISPLAY_NAME = 'Rob';
const PHOTO_URL = 'https://lh3.googleusercontent.com/a/ACg8ocIIhlI9GYEFgkm0cxbrliCY8XAhKj1YZXr2HPjfZBUc5NwiCg=s96-c';

const userRecord = {
  uid: UID,
  email: EMAIL,
  displayName: DISPLAY_NAME,
  username: 'rob_stqID',
  photoURL: PHOTO_URL,
  audienceMode: 'casual',
  badges: ['og'],
  role: 'su',
  subscriptionMetadata: {
    bundleId: 'pro-suite',
    activeSuites: [
      'registry',
      'promptmaster',
      'persona',
      'prompttool',
      'accreditation',
      'resources',
      'plantune',
      'master',
      'video'
    ],
    status: 'active'
  },
  subscription: 'pro',
  suiteSubscription: {
    bundleId: 'pro-suite',
    activeSuites: [
      'registry',
      'promptmaster',
      'persona',
      'prompttool',
      'accreditation',
      'resources',
      'plantune',
      'master',
      'video'
    ],
    status: 'active'
  }
};

const targetDatabases = [
  'promptresources-db-0',
  'promptaccreditation-db-0',
  'persona-db-0',
  'promptmaster-spa-db-0',
  'prompttool-db-0',
  'urlshortener-db-0'
];

async function seed() {
  console.log(`🚀 Initializing user activation for ${EMAIL} across the Stillwater ecosystem...`);
  
  for (const dbName of targetDatabases) {
    console.log(`\n--- Seeding Database: ${dbName} ---`);
    try {
      const db = getFirestore(adminApp, dbName);
      const userRef = db.collection('users').doc(UID);
      
      const docSnap = await userRef.get();
      if (docSnap.exists) {
        console.log(`ℹ️ Record already exists in ${dbName}. Updating fields...`);
      } else {
        console.log(`🆕 Creating fresh SU record in ${dbName}...`);
      }

      await userRef.set({
        ...userRecord,
        createdAt: docSnap.exists ? (docSnap.data()?.createdAt || new Date()) : new Date(),
        updatedAt: new Date()
      }, { merge: true });

      console.log(`✅ User successfully activated in ${dbName}!`);
    } catch (err: any) {
      console.error(`❌ Error seeding ${dbName}:`, err.message);
    }
  }

  console.log('\n🎉 Ecosystem user synchronization sequence completed.');
}

seed().catch(console.error);
