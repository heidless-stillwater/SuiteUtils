import '../server/services/config-env.js';
import { BroadcastService } from '../server/services/BroadcastService.js';
import { suiteDb } from '../server/services/FirebaseAdmin.js';

async function runSendTest() {
  console.log('=== START IMMEDIATE SEND TEST ===');
  
  const payload = {
    subject: "SuiteUtils Live Verification Test",
    category: "system" as const,
    from: "admin@fundingcloud.com",
    body: "Hello {{name}},\n\nThis is a verified test email sent from the newly integrated email broadcast service on SuiteUtils.\nYour current subscription tier is {{tier}}.\n\nThank you for verifying!\n\nBest,\nFundingCloud Operations",
    templateKey: "email-template-system",
    recipientTarget: "emails:heidlessemail18@gmail.com", // Rob's test email
  };

  try {
    console.log(`Sending immediate broadcast to: ${payload.recipientTarget}...`);
    const broadcastId = await BroadcastService.sendOrQueueBroadcast(payload);
    console.log(`✅ Broadcast queued / sent asynchronously. ID: ${broadcastId}`);
    
    // Wait a brief period (e.g. 4 seconds) for the background dispatch process to complete
    console.log('Waiting 4 seconds for background dispatch to finish processing...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Verify Firestore logs
    console.log(`Checking Firestore logs for broadcast ${broadcastId}...`);
    const broadcastDoc = await suiteDb.collection('broadcasts').doc(broadcastId).get();
    
    if (broadcastDoc.exists) {
      console.log('Broadcast Metadata Doc found in Firestore:');
      console.log(JSON.stringify(broadcastDoc.data(), null, 2));
    } else {
      console.log('❌ Broadcast metadata document NOT found!');
    }

    // Now check per-recipient delivery logs
    const recipientsSnap = await suiteDb.collection('broadcast_log')
      .doc(broadcastId)
      .collection('recipients')
      .get();

    console.log(`Delivery logs found: ${recipientsSnap.size}`);
    recipientsSnap.docs.forEach(doc => {
      console.log(`- Recipient doc ID (userId/email): ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });

  } catch (err: any) {
    console.error('❌ Immediate send failed:', err.message);
  }

  console.log('=== END IMMEDIATE SEND TEST ===');
}

runSendTest().catch(console.error);
