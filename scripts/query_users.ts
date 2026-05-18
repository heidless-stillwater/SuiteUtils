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

const targetEmail = 'heidlessemail21@gmail.com';
const targetEmailAlt = 'heidlessemail18@gmail.com';

const databases = [
  'promptmaster-spa-db-0',
  'prompttool-db-0',
  'promptresources-db-0',
  'promptaccreditation-db-0',
  'persona-db-0'
];

async function runQuery() {
  console.log(`=== Querying databases for ${targetEmail} and ${targetEmailAlt} ===\n`);

  for (const dbName of databases) {
    console.log(`--- Database: ${dbName} ---`);
    try {
      const db = getFirestore(adminApp, dbName);
      
      // Try 'users' collection
      const usersRef = db.collection('users');
      const qByEmail = await usersRef.where('email', '==', targetEmail).get();
      if (!qByEmail.empty) {
        qByEmail.docs.forEach(doc => {
          console.log(`[users] Document ID: ${doc.id}`);
          console.log(JSON.stringify(doc.data(), null, 2));
        });
      } else {
        console.log(`[users] No doc found for ${targetEmail}`);
      }

      const qByEmailAlt = await usersRef.where('email', '==', targetEmailAlt).get();
      if (!qByEmailAlt.empty) {
        qByEmailAlt.docs.forEach(doc => {
          console.log(`[users] Document ID: ${doc.id} (${targetEmailAlt})`);
          console.log(JSON.stringify(doc.data(), null, 2));
        });
      }

      // Try 'config' collection (e.g. for persona/architect configs)
      const configRef = db.collection('config');
      const configSnap = await configRef.get();
      if (!configSnap.empty) {
        console.log(`[config] Found ${configSnap.size} docs:`);
        configSnap.docs.forEach(doc => {
          if (doc.id.includes('architect') || doc.id.includes('persona')) {
            console.log(` - Doc: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
          }
        });
      }

    } catch (err: any) {
      console.error(` Error querying database ${dbName}:`, err.message);
    }
    console.log('\n');
  }
}

runQuery().catch(console.error);
