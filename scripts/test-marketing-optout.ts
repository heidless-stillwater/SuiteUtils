import '../server/services/config-env.js';
import { BroadcastService } from '../server/services/BroadcastService.js';
import { tokenmarketDb, suiteDb } from '../server/services/FirebaseAdmin.js';

const optOutUserId = 'HNlhS63O1KfSldRZVQ3nadRsGqJ2'; // heidlessemail01@gmail.com

async function runOptOutTest() {
  console.log('=== START MARKETING OPT-OUT TEST ===');
  
  try {
    // 1. Set opt-out to false in Firestore for user HNlhS63O1KfSldRZVQ3nadRsGqJ2
    console.log(`Setting marketingEmailsEnabled = false for user ${optOutUserId}...`);
    await tokenmarketDb.collection('users').doc(optOutUserId).update({
      marketingEmailsEnabled: false
    });
    console.log('✅ User updated to opted-out.');

    // 2. Queue marketing broadcast targeting 'all'
    const payload = {
      subject: "Exclusive Market Insights (Marketing)",
      category: "marketing" as const,
      from: "marketing@fundingcloud.com",
      body: "Hello {{name}},\n\nCheck out this amazing opportunity to boost your token portfolio! Get standard or pro subscription tier today.\n\nBest,\nMarketing Team",
      templateKey: "email-template-marketing",
      recipientTarget: "all"
    };

    console.log('Sending marketing campaign to "all" users...');
    const broadcastId = await BroadcastService.sendOrQueueBroadcast(payload);
    console.log(`✅ Marketing broadcast queued. ID: ${broadcastId}`);

    // 3. Wait 5 seconds for dispatch
    console.log('Waiting 5 seconds for background sequential dispatch...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Verify Firestore per-recipient logs
    console.log(`Checking per-recipient logs for broadcast ${broadcastId}...`);
    const recipientsSnap = await suiteDb.collection('broadcast_log')
      .doc(broadcastId)
      .collection('recipients')
      .get();

    console.log(`Logs found: ${recipientsSnap.size}`);
    recipientsSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Recipient doc ID: ${doc.id}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Reason: ${data.reason || 'None'}`);
      console.log(`  SentAt: ${data.sentAt}`);
    });

  } catch (err: any) {
    console.error('❌ Marketing opt-out test failed:', err.message);
  } finally {
    // 5. Cleanup: Restore user HNlhS63O1KfSldRZVQ3nadRsGqJ2 to true
    try {
      console.log(`Restoring marketingEmailsEnabled = true for user ${optOutUserId}...`);
      await tokenmarketDb.collection('users').doc(optOutUserId).update({
        marketingEmailsEnabled: true
      });
      console.log('✅ User restored successfully.');
    } catch (err: any) {
      console.error('❌ Cleanup failed:', err.message);
    }
  }

  console.log('=== END MARKETING OPT-OUT TEST ===');
}

runOptOutTest().catch(console.error);
