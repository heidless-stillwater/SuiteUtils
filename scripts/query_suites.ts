import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import { suiteDb } from '../server/services/FirebaseAdmin';

async function main() {
  const doc = await suiteDb.collection('suites').doc('stillwater-suite').get();
  if (doc.exists) {
    const data = doc.data();
    console.log("Suite name:", data?.name);
    console.log("Persona AppConfig in firestore:", JSON.stringify(data?.apps?.persona || data?.['apps.persona'] || {}, null, 2));
  } else {
    console.log("stillwater-suite doc does not exist!");
  }
}

main().catch(console.error);
