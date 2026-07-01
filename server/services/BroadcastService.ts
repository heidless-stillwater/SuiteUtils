import { getFirestore } from 'firebase-admin/firestore';
import { suiteDb, tokenmarketDb } from './FirebaseAdmin.js';
import EmailService from './EmailService.js';

export interface BroadcastPayload {
  subject: string;
  category: 'system' | 'marketing' | 'policy';
  from: string;
  body: string;
  templateKey: string;
  recipientTarget: string; // e.g. 'all' | 'tier:free' | 'uid:<id>' | 'emails:<list>'
  scheduledAt?: string; // ISO string
  createdBy?: string;
}

export interface BroadcastDocument extends BroadcastPayload {
  id: string;
  status: 'queued' | 'sending' | 'complete' | 'failed';
  createdAt: string;
  completedAt?: string;
  sentCount: number;
  failedCount: number;
  error?: string | null;
}

export interface RecipientInfo {
  userId?: string;
  email: string;
  name: string;
  tier: string;
}

export class BroadcastService {
  /**
   * Resolves recipient target to a list of users/emails.
   */
  static async resolveRecipients(recipientTarget: string): Promise<RecipientInfo[]> {
    const recipients: RecipientInfo[] = [];

    if (!recipientTarget) {
      return recipients;
    }

    // 1. Single User by UID: uid:<id>
    if (recipientTarget.startsWith('uid:')) {
      const uid = recipientTarget.replace(/^uid:/, '').trim();
      const userDoc = await tokenmarketDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data = userDoc.data() || {};
        recipients.push({
          userId: uid,
          email: data.email || '',
          name: data.displayName || data.name || data.firstName || '',
          tier: data.subscriptionTier || data.tier || 'free',
        });
      }
    }
    // 2. By Subscription Tier: tier:<tier_name> (e.g. tier:free, tier:pro)
    else if (recipientTarget.startsWith('tier:')) {
      const targetTier = recipientTarget.replace(/^tier:/, '').trim().toLowerCase();
      
      // Try querying subscriptionTier
      let usersSnap = await tokenmarketDb.collection('users').where('subscriptionTier', '==', targetTier).get();
      if (usersSnap.empty) {
        // Fallback: try querying 'tier' field
        usersSnap = await tokenmarketDb.collection('users').where('tier', '==', targetTier).get();
      }

      usersSnap.docs.forEach(doc => {
        const data = doc.data() || {};
        if (data.email) {
          recipients.push({
            userId: doc.id,
            email: data.email,
            name: data.displayName || data.name || data.firstName || '',
            tier: data.subscriptionTier || data.tier || targetTier,
          });
        }
      });
    }
    // 3. Custom Email List: emails:email1@domain.com,email2@domain.com OR array inside target
    else if (recipientTarget.startsWith('emails:')) {
      const rawList = recipientTarget.replace(/^emails:/, '').trim();
      const emailStrings = rawList.split(',').map(e => e.trim()).filter(Boolean);
      
      for (const email of emailStrings) {
        // Query to see if there is an associated user document in TokenMarket to enrich with variables
        const userQuery = await tokenmarketDb.collection('users').where('email', '==', email).get();
        if (!userQuery.empty) {
          const doc = userQuery.docs[0];
          const data = doc.data() || {};
          recipients.push({
            userId: doc.id,
            email,
            name: data.displayName || data.name || data.firstName || '',
            tier: data.subscriptionTier || data.tier || 'free',
          });
        } else {
          recipients.push({
            email,
            name: '', // Fallback name
            tier: 'free',
          });
        }
      }
    }
    // 4. All Users: all
    else if (recipientTarget === 'all') {
      const usersSnap = await tokenmarketDb.collection('users').get();
      usersSnap.docs.forEach(doc => {
        const data = doc.data() || {};
        if (data.email) {
          recipients.push({
            userId: doc.id,
            email: data.email,
            name: data.displayName || data.name || data.firstName || '',
            tier: data.subscriptionTier || data.tier || 'free',
          });
        }
      });
    }

    // Deduplicate recipients by email
    const seen = new Set<string>();
    return recipients.filter(r => {
      if (!r.email) return false;
      const lower = r.email.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }

  /**
   * Fetches recipient count based on target (considering opt-outs for Marketing).
   */
  static async previewRecipientCount(target: string, category: string): Promise<number> {
    const recipients = await this.resolveRecipients(target);
    
    if (category === 'marketing') {
      // Need to filter out unsubscribed users
      let count = 0;
      for (const rec of recipients) {
        if (rec.userId) {
          const userDoc = await tokenmarketDb.collection('users').doc(rec.userId).get();
          const data = userDoc.data() || {};
          if (data.marketingEmailsEnabled === false) {
            continue; // Skip
          }
        }
        count++;
      }
      return count;
    }

    return recipients.length;
  }

  /**
   * Queues a broadcast, or sends immediately if scheduled for now/past.
   */
  static async sendOrQueueBroadcast(payload: BroadcastPayload): Promise<string> {
    const now = new Date().toISOString();
    const scheduledAt = payload.scheduledAt || now;
    
    const broadcastDoc: Omit<BroadcastDocument, 'id'> = {
      ...payload,
      scheduledAt,
      status: 'queued',
      createdAt: now,
      sentCount: 0,
      failedCount: 0,
      error: null
    };

    // Add to SuiteUtils Firestore broadcasts collection
    const docRef = await suiteDb.collection('broadcasts').add(broadcastDoc);
    const broadcastId = docRef.id;

    // Update document with its ID
    await docRef.update({ id: broadcastId });

    // If immediate send (scheduledAt <= now), dispatch in background
    if (scheduledAt <= now) {
      console.log(`[BroadcastService] Immediate dispatch triggered for broadcast: ${broadcastId}`);
      // Run execution asynchronously
      this.processBroadcast(broadcastId).catch(err => {
        console.error(`[BroadcastService] Background dispatch failed for broadcast ${broadcastId}:`, err);
      });
    } else {
      console.log(`[BroadcastService] Broadcast ${broadcastId} queued for ${scheduledAt}`);
    }

    return broadcastId;
  }

  /**
   * Scans and processes queued broadcasts scheduled to run at or before now.
   */
  static async processQueue(): Promise<void> {
    const now = new Date().toISOString();
    console.log(`[BroadcastService] Scanning queue at ${now}...`);

    try {
      // Query all queued broadcasts (uses simple index, avoiding composite index FAILED_PRECONDITION)
      const queuedSnap = await suiteDb.collection('broadcasts')
        .where('status', '==', 'queued')
        .get();

      if (queuedSnap.empty) {
        console.log('[BroadcastService] No queued broadcasts to process.');
        return;
      }

      // Filter eligible scheduled times in-memory
      const eligibleDocs = queuedSnap.docs.filter(doc => {
        const data = doc.data();
        return data.scheduledAt && data.scheduledAt <= now;
      });

      if (eligibleDocs.length === 0) {
        console.log('[BroadcastService] No scheduled broadcasts are due for processing.');
        return;
      }

      console.log(`[BroadcastService] Found ${eligibleDocs.length} broadcasts to process.`);
      for (const doc of eligibleDocs) {
        const id = doc.id;
        console.log(`[BroadcastService] Processing queued broadcast: ${id}`);
        await this.processBroadcast(id);
      }
    } catch (err: any) {
      console.error('[BroadcastService] Error in processQueue:', err.message);
    }
  }

  /**
   * Processes a single broadcast (sends to resolved recipients, writes logs, updates status).
   */
  static async processBroadcast(broadcastId: string): Promise<void> {
    console.log(`[BroadcastService] Starting processing of broadcast: ${broadcastId}`);
    const docRef = suiteDb.collection('broadcasts').doc(broadcastId);
    
    // Atomically try to acquire sending status to prevent double processing
    let updatedSuccessfully = false;
    await suiteDb.runTransaction(async (transaction) => {
      const freshDoc = await transaction.get(docRef);
      if (!freshDoc.exists) {
        throw new Error(`Broadcast ${broadcastId} does not exist`);
      }
      const data = freshDoc.data() as BroadcastDocument;
      if (data.status === 'sending' || data.status === 'complete') {
        console.log(`[BroadcastService] Broadcast ${broadcastId} is already in state: ${data.status}`);
        return;
      }
      transaction.update(docRef, { status: 'sending' });
      updatedSuccessfully = true;
    });

    if (!updatedSuccessfully) return;

    try {
      // Retrieve full data
      const docSnap = await docRef.get();
      const broadcast = docSnap.data() as BroadcastDocument;

      const { subject, category, from, body, templateKey, recipientTarget } = broadcast;

      // 1. Fetch template from TokenMarket content
      let htmlTemplate = '';
      if (templateKey) {
        try {
          const templateDoc = await tokenmarketDb.collection('market_content').doc(templateKey).get();
          if (templateDoc.exists) {
            htmlTemplate = templateDoc.data()?.content || '';
          } else {
            console.warn(`[BroadcastService] Seeded template ${templateKey} not found. Falling back to plain-text style.`);
          }
        } catch (err: any) {
          console.error(`[BroadcastService] Failed to load template ${templateKey}:`, err.message);
        }
      }

      // Default basic html template if no template was found
      if (!htmlTemplate) {
        htmlTemplate = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 40px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; padding: 30px; border-radius: 8px;">
              <h2>{{subject}}</h2>
              <div style="line-height: 1.6; font-size: 15px;">{{body}}</div>
              <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;">
              <p style="font-size: 12px; color: #64748b;">Recipient: {{name}} (Tier: {{tier}})</p>
              {{unsubscribe_section}}
            </div>
          </body>
          </html>
        `;
      }

      // 2. Resolve recipients
      const recipients = await this.resolveRecipients(recipientTarget);
      console.log(`[BroadcastService] Resolved ${recipients.length} recipients for broadcast: ${broadcastId}`);

      let sentCount = 0;
      let failedCount = 0;

      // Configure base URL for unsubscribe
      const apiPort = process.env.API_PORT || process.env.PORT || '5185';
      const baseUrl = process.env.SUITEUTILS_BASE_URL || `http://localhost:${apiPort}`;

      // 3. Process each recipient sequentially or in batches (Gmail friendly rate limits)
      for (const rec of recipients) {
        const { userId, email, name, tier } = rec;
        const recipientDocId = userId || email.replace(/[^a-zA-Z0-9]/g, '_');
        const recipientLogRef = suiteDb.collection('broadcast_log').doc(broadcastId).collection('recipients').doc(recipientDocId);

        // A. Filter Marketing Opt-out
        if (category === 'marketing' && userId) {
          try {
            const userDoc = await tokenmarketDb.collection('users').doc(userId).get();
            const userData = userDoc.data() || {};
            if (userData.marketingEmailsEnabled === false) {
              console.log(`[BroadcastService] Skipping marketing opt-out user: ${email}`);
              await recipientLogRef.set({
                email,
                name: name || 'Valued Member',
                tier,
                status: 'skipped',
                reason: 'unsubscribed',
                sentAt: new Date().toISOString()
              });
              continue;
            }
          } catch (err: any) {
            console.error(`[BroadcastService] Error verifying opt-out for ${email}:`, err.message);
          }
        }

        // B. Variable Interpolation
        const unsubscribeLink = `${baseUrl}/api/support/unsubscribe?email=${encodeURIComponent(email)}`;
        const displayName = name || 'Valued Member';
        
        let renderedHtml = htmlTemplate
          .replace(/\{\{subject\}\}/g, subject)
          .replace(/\{\{body\}\}/g, body.replace(/\n/g, '<br/>'))
          .replace(/\{\{name\}\}/g, displayName)
          .replace(/\{\{tier\}\}/g, tier.toUpperCase())
          .replace(/\{\{unsubscribeLink\}\}/g, unsubscribeLink);

        // Fallback for simple template unsubscribe section
        if (renderedHtml.includes('{{unsubscribe_section}}')) {
          if (category === 'marketing') {
            renderedHtml = renderedHtml.replace('{{unsubscribe_section}}', `
              <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 20px;">
                If you no longer wish to receive marketing emails, you can 
                <a href="${unsubscribeLink}" style="color: #38bdf8; text-decoration: underline;">unsubscribe here</a>.
              </p>
            `);
          } else {
            renderedHtml = renderedHtml.replace('{{unsubscribe_section}}', '');
          }
        }

        // C. SMTP Dispatch via EmailService
        try {
          const fromLabel = category === 'marketing' ? 'TokenMarket Insights' : 'TokenMarket Support';
          
          await EmailService.sendMail({
            from: `"${fromLabel}" <${from}>`,
            to: email,
            subject: subject,
            text: body, // plain text fallback
            html: renderedHtml
          });

          // Write successful recipient log
          await recipientLogRef.set({
            email,
            name: displayName,
            tier,
            status: 'sent',
            sentAt: new Date().toISOString(),
            error: null
          });

          sentCount++;
          console.log(`[BroadcastService] Broadcast ${broadcastId} successfully delivered to ${email}`);
        } catch (err: any) {
          console.error(`[BroadcastService] Delivery failed to ${email}:`, err.message);
          
          // Write failed recipient log
          await recipientLogRef.set({
            email,
            name: displayName,
            tier,
            status: 'failed',
            sentAt: new Date().toISOString(),
            error: err.message
          });

          failedCount++;
        }

        // Subtle micro-delay between sends to avoid rate limits / connection choking
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 4. Update the Broadcast main document state
      await docRef.update({
        status: 'complete',
        sentCount,
        failedCount,
        completedAt: new Date().toISOString()
      });

      console.log(`[BroadcastService] Broadcast ${broadcastId} completed processing. Sent: ${sentCount}, Failed: ${failedCount}`);

    } catch (err: any) {
      console.error(`[BroadcastService] Critical failure processing broadcast ${broadcastId}:`, err.message);
      await docRef.update({
        status: 'failed',
        error: err.message,
        completedAt: new Date().toISOString()
      });
    }
  }
}
