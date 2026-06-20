const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('/home/heidless/projects/SuiteUtils/server/config/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = getFirestore(admin.app(), 'suiteutils-db-0');

async function listSuites() {
    console.log('--- Suites Collection (suiteutils-db-0) ---');
    const snap = await db.collection('suites').get();
    if (snap.empty) {
        console.log('No suites found.');
        return;
    }
    snap.forEach(doc => {
        console.log(`- ID: ${doc.id}, Name: ${doc.data().name}`);
    });
}

listSuites().catch(console.error);
