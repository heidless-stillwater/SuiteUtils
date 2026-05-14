
import { suiteDb as firestore } from '../server/services/FirebaseAdmin.js';

async function checkPersona() {
  const doc = await firestore.collection('suites').doc('stillwater-suite').get();
  if (doc.exists) {
    const data = doc.data();
    if (data) {
      console.log('Apps:', Object.keys(data.apps || {}));
      if (data.apps?.persona) {
        console.log('Persona Data:', JSON.stringify(data.apps.persona, null, 2));
      } else {
        console.log('Persona missing from apps map');
      }
      console.log('Top level keys:', Object.keys(data));
    }
  } else {
    console.log('Suite doc not found');
  }
  process.exit(0);
}

checkPersona();
