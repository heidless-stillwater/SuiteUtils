import '../server/services/config-env.js';
import { BroadcastService } from '../server/services/BroadcastService.js';
import { suiteDb } from '../server/services/FirebaseAdmin.js';

async function runScheduledQueueTest() {
  console.log('=== START SCHEDULED QUEUE WORKER TEST ===');
  
  // Set scheduledAt to 10 seconds in the past to make sure it is eligible for immediate pickup by the queue scanner
  const scheduledTime = new Date(Date.now() - 10000).toISOString();

  const payload = {
    subject: "Scheduled Operations Alert (Cron Worker)",
    category: "system" as const,
    from: "admin@fundingcloud.com",
    body: "Hello {{name}},\n\nThis scheduled alert was successfully picked up and delivered by our automated cron broadcast worker. Your tier is {{tier}}.\n\nBest,\nAutomated Scheduler",
    templateKey: "email-template-system",
    recipientTarget: "emails:heidlessemail18@gmail.com",
    scheduledAt: scheduledTime
  };

  try {
    console.log(`Creating scheduled broadcast document (scheduled for ${scheduledTime})...`);
    
    // We queue it using the service. Because scheduledAt is in the past, sendOrQueueBroadcast will dispatch it immediately if we don't bypass it.
    // Wait, to specifically test processQueue(), let's manually write the doc to Firestore with 'queued' status, then let processQueue() process it!
    const docRef = await suiteDb.collection('broadcasts').add({
      ...payload,
      status: 'queued',
      createdAt: new Date().toISOString(),
      sentCount: 0,
      failedCount: 0,
      error: null
    });
    const broadcastId = docRef.id;
    await docRef.update({ id: broadcastId });
    console.log(`✅ Scheduled campaign written manually to Firestore as "queued". ID: ${broadcastId}`);

    // Verify it is sitting in the queued state
    let docSnap = await docRef.get();
    console.log(`Initial status in database: "${docSnap.data()?.status}"`);

    // Now trigger the queue pickup worker
    console.log('Simulating broadcast-worker cron execution: triggering processQueue()...');
    await BroadcastService.processQueue();

    // Wait a brief moment for async transaction write-backs to finish
    console.log('Waiting 3 seconds for logs to write...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify that the status changed to complete
    docSnap = await docRef.get();
    console.log('Campaign final state in database:');
    console.log(JSON.stringify(docSnap.data(), null, 2));

    // Query per-recipient logs for this scheduled run
    const recipientsSnap = await suiteDb.collection('broadcast_log')
      .doc(broadcastId)
      .collection('recipients')
      .get();

    console.log(`Delivery logs found for scheduled run: ${recipientsSnap.size}`);
    recipientsSnap.docs.forEach(doc => {
      console.log(`- Recipient doc ID (userId/email): ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });

  } catch (err: any) {
    console.error('❌ Scheduled queue test failed:', err.message);
  }

  console.log('=== END SCHEDULED QUEUE WORKER TEST ===');
}

runScheduledQueueTest().catch(console.error);
