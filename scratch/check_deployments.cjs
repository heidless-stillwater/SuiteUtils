const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('/home/heidless/projects/SuiteUtils/server/config/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = getFirestore(admin.app(), 'suiteutils-db-0');

async function checkDeployments() {
    const suiteId = 'OlgqXSyKR8Cm3gUZErE7';
    console.log(`--- Deployment Records for Suite: ${suiteId} ---`);
    const snapshot = await db.collection('deployments')
        .where('suiteId', '==', suiteId)
        .orderBy('startedAt', 'desc')
        .limit(10)
        .get();
        
    if (snapshot.empty) {
        console.log('No deployment records found for this suite.');
        return;
    }
    
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`[${doc.id}] App: ${data.appId}, Status: ${data.status}, Time: ${data.startedAt?.toDate()}`);
    });
}

checkDeployments().catch(console.error);
