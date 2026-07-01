import { tokenmarketDb } from '../server/services/FirebaseAdmin.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log('=== TokenMarket Database Users ===');
  const snap = await tokenmarketDb.collection('users').get();
  console.log(`Total users found: ${snap.size}`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}`);
    console.log(`  Email: ${data.email}`);
    console.log(`  Name: ${data.displayName || data.name || data.firstName || 'N/A'}`);
    console.log(`  Tier (subscriptionTier): ${data.subscriptionTier || 'N/A'}`);
    console.log(`  Tier (tier): ${data.tier || 'N/A'}`);
    console.log(`  Marketing Enabled: ${data.marketingEmailsEnabled !== false}`);
    console.log('------------------------------');
  });
}

run().catch(console.error);
