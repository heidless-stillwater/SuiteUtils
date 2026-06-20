import dotenv from 'dotenv';
dotenv.config();

import { suiteDb } from '../server/services/FirebaseAdmin.js';

async function main() {
  const suiteRef = suiteDb.collection('suites').doc('stillwater-suite');
  const doc = await suiteRef.get();
  const apps = doc.data()?.apps;
  
  if (!apps) {
    console.error("No apps data found!");
    return;
  }
  
  for (const [appId, app] of Object.entries(apps as Record<string, any>)) {
    console.log(`\n=== ${appId} ===`);
    console.log(JSON.stringify(app.environments?.production, null, 2));
  }
}

main().catch(console.error);
