import dotenv from 'dotenv';
dotenv.config();

import { suiteDb } from '../server/services/FirebaseAdmin.js';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const suiteRef = suiteDb.collection('suites').doc('stillwater-suite');
  
  // Write
  await suiteRef.update({
    'apps.prompttool.environments.production.hostingTarget': 'stillwater-prompt-tool-test-revert'
  });
  console.log("Written: stillwater-prompt-tool-test-revert");
  
  // Read immediately
  let doc = await suiteRef.get();
  console.log("Immediate Read:", doc.data()?.apps?.prompttool?.environments?.production?.hostingTarget);
  
  // Wait 3 seconds
  console.log("Waiting 3 seconds...");
  await wait(3000);
  
  // Read again
  doc = await suiteRef.get();
  console.log("After 3 seconds:", doc.data()?.apps?.prompttool?.environments?.production?.hostingTarget);
}

main().catch(console.error);
