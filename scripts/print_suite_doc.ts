import dotenv from 'dotenv';
import { suiteDb } from '../server/services/FirebaseAdmin';

dotenv.config();

async function main() {
  const doc = await suiteDb.collection('suites').doc('stillwater-suite').get();
  if (doc.exists) {
    const data = doc.data();
    console.log("Apps keys in Firestore:", Object.keys(data?.apps || {}));
    console.log("Full apps object keys and displayNames:");
    for (const [key, app] of Object.entries(data?.apps || {})) {
      console.log(`- ${key}: ${(app as any).displayName}`);
    }
  } else {
    console.log("stillwater-suite doc does not exist!");
  }
}

main().catch(console.error);
