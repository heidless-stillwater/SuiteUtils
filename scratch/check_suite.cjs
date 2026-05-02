const admin = require('firebase-admin');
const serviceAccount = require('/home/heidless/projects/SuiteUtils/server/config/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore('suiteutils-db-0');

async function checkSuite() {
    const suiteId = 'OlgqXSyKR8Cm3gUZErE7';
    console.log(`--- Checking Suite: ${suiteId} ---`);
    const doc = await db.collection('suites').doc(suiteId).get();
    if (!doc.exists) {
        console.log('Suite document not found.');
        return;
    }
    
    const data = doc.data();
    const prompttool = data.apps?.prompttool?.environments?.production;
    console.log(`Status: ${prompttool?.status}`);
    console.log(`Last Deploy: ${prompttool?.lastDeployAt?.toDate()}`);
}

checkSuite().catch(console.error);
