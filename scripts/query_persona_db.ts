import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import { personaDb } from '../server/services/FirebaseAdmin';

async function main() {
  console.log("Querying persona-db-0 collections...");
  const collections = await personaDb.listCollections();
  console.log(`Found ${collections.length} collections:`, collections.map(c => c.id));
  
  for (const coll of collections) {
    const snap = await coll.get();
    console.log(`\n--- Collection: ${coll.id} (docs: ${snap.size}) ---`);
    for (const doc of snap.docs) {
      console.log(`Document: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    }
  }
}

main().catch(console.error);
