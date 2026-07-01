// support router – provides ticket creation and retrieval (authenticated)
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import TicketStore from '../services/TicketStore.js';
import EmailService from '../services/EmailService.js';
import { adminAuth, suiteDb, adminApp } from '../services/FirebaseAdmin.js';

const router = express.Router();

// Helper middleware to verify Firebase token and attach userId & email
async function verifyAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    (req as any).userId = decoded.uid;
    (req as any).userEmail = decoded.email || '';
    next();
  } catch (err: any) {
    console.error('[SupportAuth] token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper middleware to verify admin privileges
async function verifyAdmin(req: Request, res: Response, next: Function) {
  // First run verifyAuth to check token
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || '';
    const uid = decoded.uid;

    // Check by env variable VITE_ADMIN_EMAILS first
    const adminEmailsEnv = process.env.VITE_ADMIN_EMAILS || 'lockhart.r@gmail.com';
    const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase());

    if (adminEmails.includes(email.toLowerCase())) {
      (req as any).userId = uid;
      (req as any).userEmail = email;
      return next();
    }

    // Check Firestore user doc
    const userDoc = await suiteDb.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data && (data.role === 'admin' || data.role === 'su' || data.actingAs === 'admin' || data.actingAs === 'su')) {
        (req as any).userId = uid;
        (req as any).userEmail = email;
        return next();
      }
    }

    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  } catch (err: any) {
    console.error('[SupportAdminAuth] verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Route for creating a ticket (regular user auth)
router.post('/ticket', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).userEmail;
  const {
    subject = '',
    description = '',
    app = 'SuiteUtils',
    function: func = '<unset>',
    priority = 'medium',
    metadata = {}
  } = req.body;

  try {
    const ticket = await TicketStore.createTicket(userId, {
      userEmail,
      subject,
      description,
      app,
      function: func,
      priority,
      metadata,
    });
    res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    console.error('[Support] ticket creation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route for user's tickets (regular user auth)
router.get('/tickets', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const tickets = await TicketStore.getTicketsByUser(userId);
    res.json({ success: true, tickets });
  } catch (err: any) {
    console.error('[Support] fetch user tickets error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Admin Route: Get all tickets
router.get('/admin/tickets', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const tickets = await TicketStore.getAllTickets();
    res.json({ success: true, tickets });
  } catch (err: any) {
    console.error('[SupportAdmin] fetch all tickets error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Admin Route: Update ticket status/comment
router.put('/admin/tickets/:id', verifyAdmin, async (req: Request, res: Response) => {
  const ticketId = req.params.id as string;
  const adminUserId = (req as any).userId;
  const adminEmail = (req as any).userEmail;
  const { status, priority, comment, notes, links } = req.body;

  try {
    const ticket = await TicketStore.updateTicketStatus(
      ticketId,
      { status, priority, comment, notes, links },
      adminUserId,
      adminEmail
    );
    res.json({ success: true, ticket });
  } catch (err: any) {
    console.error('[SupportAdmin] update ticket error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /faqs – returns FAQ list
router.get('/faqs', async (req: Request, res: Response) => {
  try {
    const faqPath = path.join(process.cwd(), 'config', 'faq.json');
    if (!fs.existsSync(faqPath)) {
      return res.json([]);
    }
    const raw = fs.readFileSync(faqPath, 'utf8');
    const faqs = JSON.parse(raw);
    res.json(faqs);
  } catch (err: any) {
    console.error('[Support] faqs fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route to purge all user data from Firestore (user profile in tokenmarket and tickets in suiteutils)
router.post('/purge-user', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    // 1. Delete tickets in suiteDb
    const ticketsQuery = await suiteDb.collection('tickets').where('userId', '==', userId).get();
    const deleteTicketPromises = ticketsQuery.docs.map(doc => doc.ref.delete());
    await Promise.all(deleteTicketPromises);

    // 2. Delete user profile in tokenmarketDb
    const { getFirestore } = await import('firebase-admin/firestore');
    const tokenmarketDb = getFirestore(adminApp, 'tokenmarket-db-0');
    await tokenmarketDb.collection('users').doc(userId).delete();

    res.json({ success: true, message: 'Firestore user data purged successfully.' });
  } catch (err: any) {
    console.error('[Support] user purge error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route to unsubscribe an email from marketing communications
router.get('/unsubscribe', async (req: Request, res: Response) => {
  const emailQuery = req.query.email;
  if (!emailQuery || typeof emailQuery !== 'string') {
    return res.status(400).send('<h1>Error</h1><p>Missing or invalid email parameter.</p>');
  }
  const email = emailQuery;
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const tokenmarketDb = getFirestore(adminApp, 'tokenmarket-db-0');
    const usersQuery = await tokenmarketDb.collection('users').where('email', '==', email).get();
    if (usersQuery.empty) {
      return res.status(404).send('<h1>Account Not Found</h1><p>No account associated with this email address was found.</p>');
    }
    const updatePromises = usersQuery.docs.map(doc => doc.ref.update({ marketingEmailsEnabled: false, updatedAt: new Date().toISOString() }));
    await Promise.all(updatePromises);
    
    res.send(`
      <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: rgba(25, 29, 38, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 40px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); max-width: 400px; }
            h1 { color: #00e5ff; font-size: 24px; margin-bottom: 16px; }
            p { color: #9ca3af; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Unsubscribed</h1>
            <p>You have been successfully unsubscribed from TokenMarket marketing and promotional communications.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[Support] unsubscribe error:', err.message);
    res.status(500).send(`<h1>Error</h1><p>Failed to process unsubscribe request: ${err.message}</p>`);
  }
});

// Route to send a mock marketing email for testing purposes
router.post('/send-mock-marketing', verifyAuth, async (req: Request, res: Response) => {
  const userEmail = (req as any).userEmail;
  const userId = (req as any).userId;
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const tokenmarketDb = getFirestore(adminApp, 'tokenmarket-db-0');
    const tmUser = await tokenmarketDb.collection('users').doc(userId).get();
    
    let optIn = false;
    if (tmUser.exists) {
      optIn = tmUser.data()?.marketingEmailsEnabled ?? false;
    }

    if (!optIn) {
      return res.status(400).json({ error: 'User is not subscribed to marketing communications.' });
    }

    const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/support/unsubscribe?email=${encodeURIComponent(userEmail)}`;

    await EmailService.sendMail({
      from: '"TokenMarket Promo" <promo@fundingcloud.com>',
      to: userEmail,
      subject: 'Weekly AI Sector Intelligence Update',
      text: `Hello,\n\nHere is your weekly update on AI commodities and compute indexes...\n\nTo stop receiving these emails, unsubscribe here: ${unsubscribeUrl}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b0f19; color: #f3f4f6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <h2 style="color: #00e5ff; margin-top: 0;">Weekly AI Index Intelligence</h2>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">Here is your weekly update on AI commodities and compute indexes...</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
          <p style="font-size: 11px; color: #6b7280; text-align: center; margin: 0;">
            You received this because you subscribed to TokenMarket updates.
            <br /><br />
            <a href="${unsubscribeUrl}" style="color: #00e5ff; text-decoration: underline;">UNSUBSCRIBE</a> from future mailings.
          </p>
        </div>
      `
    });

    res.json({ success: true, message: 'Mock marketing email sent. Check logs/email_inbox.json' });
  } catch (err: any) {
    console.error('[Support] send marketing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route to submit a US Privacy Request (unauthenticated)
router.post('/privacy-request', async (req: Request, res: Response) => {
  const { name, email, requestType, message } = req.body;

  // Validate required fields
  if (!name || !email || !requestType || !message) {
    return res.status(400).json({ error: 'All fields are required: name, email, requestType, message.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const validTypes = [
    'right-to-know',
    'right-to-delete',
    'right-to-opt-out',
    'right-to-correct',
    'do-not-sell',
    'other'
  ];
  if (!validTypes.includes(requestType)) {
    return res.status(400).json({ error: 'Invalid requestType value.' });
  }

  try {
    // Write to Firestore privacy_requests collection
    const requestRef = suiteDb.collection('privacy_requests').doc();
    const referenceId = requestRef.id.substring(0, 8).toUpperCase();
    await requestRef.set({
      referenceId,
      name,
      email,
      requestType,
      message,
      status: 'pending',
      submittedAt: new Date().toISOString()
    });

    // Send admin notification email
    const requestTypeLabels: Record<string, string> = {
      'right-to-know': 'Right to Know (Data Access)',
      'right-to-delete': 'Right to Delete (Data Erasure)',
      'right-to-opt-out': 'Right to Opt-Out of Sale',
      'right-to-correct': 'Right to Correct',
      'do-not-sell': 'Do Not Sell or Share My Personal Information',
      'other': 'Other'
    };
    const typeLabel = requestTypeLabels[requestType] || requestType;

    await EmailService.sendMail({
      from: '"TokenMarket Privacy" <privacy@fundingcloud.com>',
      to: process.env.SUPPORT_PRIMARY_EMAIL || 'heidlessemail19@gmail.com',
      subject: `[Privacy Request] ${typeLabel} — Ref: ${referenceId}`,
      text: `New US Privacy Request\n\nReference: ${referenceId}\nType: ${typeLabel}\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\nSubmitted: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b0f19; color: #f3f4f6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <h2 style="color: #00e5ff; margin-top: 0;">New US Privacy Request</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">Reference</td><td style="padding: 8px 0; font-family: monospace; color: #00e5ff;">${referenceId}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Type</td><td style="padding: 8px 0;">${typeLabel}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Name</td><td style="padding: 8px 0;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;">${email}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 16px 0;" />
          <p style="font-size: 11px; color: #6b7280;">Submitted: ${new Date().toISOString()}</p>
        </div>
      `
    });

    // Send confirmation receipt back to the submitter
    await EmailService.sendMail({
      from: '"TokenMarket Privacy" <privacy@fundingcloud.com>',
      to: email,
      subject: `[Privacy Request Received] Confirmation Ref: ${referenceId}`,
      text: `Hello ${name},\n\nWe have received your US privacy request (Reference ID: ${referenceId}). We will review and process your request within the legally required timeframe.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b0f19; color: #f3f4f6; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <h2 style="color: #00e5ff; margin-top: 0;">Privacy Request Received</h2>
          <p style="color: #d1d5db; font-size: 14px;">Hello ${name},</p>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">We have received your US privacy request. Our team will review and process it within the legally required timeframe.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px;">
            <tr><td style="padding: 8px 12px; color: #6b7280; width: 120px;">Reference ID</td><td style="padding: 8px 12px; font-family: monospace; color: #00e5ff;">${referenceId}</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280;">Request Type</td><td style="padding: 8px 12px;">${typeLabel}</td></tr>
          </table>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">If you have any questions, please contact us at <a href="mailto:privacy@fundingcloud.com" style="color: #00e5ff;">privacy@fundingcloud.com</a>.</p>
          <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;" />
          <p style="font-size: 11px; color: #6b7280; text-align: center; margin: 0;">TokenMarket Privacy Compliance Team</p>
        </div>
      `
    });

    res.status(201).json({ success: true, referenceId });
  } catch (err: any) {
    console.error('[Support] privacy-request error:', err.message);
    res.status(500).json({ error: 'Failed to submit privacy request. Please try again.' });
  }
});

// Helper: Custom lightweight Markdown parser optimized for strictly compatible email clients
function markdownToEmailHtml(markdown: string): string {
  // Escapes simple brackets to maintain HTML sanity but trusted admin content
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = html.split('\n');
  const processedBlocks: string[] = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    
    // Check for unordered list items starting with '*' or '-'
    const matchListItem = line.match(/^(\s*)[\*\-]\s+(.*)$/);
    if (matchListItem) {
      if (!inList) {
        processedBlocks.push('<ul style="margin-top: 8px; margin-bottom: 16px; padding-left: 20px; color: #d1d5db;">');
        inList = true;
      }
      let content = matchListItem[2];
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>');
      content = content.replace(/\*(.*?)\*/g, '<em style="color: #d1d5db;">$1</em>');
      content = content.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #00e5ff; text-decoration: underline; font-weight: 500;">$1</a>');
      processedBlocks.push(`<li style="margin-bottom: 6px; line-height: 1.6; font-size: 14px; color: #d1d5db;">${content}</li>`);
    } else {
      if (inList) {
        processedBlocks.push('</ul>');
        inList = false;
      }

      if (trimmed === '') {
        processedBlocks.push('<br />');
        continue;
      }

      // Check for headings
      const matchH1 = trimmed.match(/^# (.*)$/);
      const matchH2 = trimmed.match(/^## (.*)$/);
      const matchH3 = trimmed.match(/^### (.*)$/);
      
      let parsedLine = trimmed;
      parsedLine = parsedLine.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>');
      parsedLine = parsedLine.replace(/\*(.*?)\*/g, '<em style="color: #d1d5db;">$1</em>');
      parsedLine = parsedLine.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #00e5ff; text-decoration: underline; font-weight: 500;">$1</a>');

      if (matchH1) {
        processedBlocks.push(`<h1 style="color: #00e5ff; font-size: 22px; margin-top: 24px; margin-bottom: 12px; font-weight: 700; line-height: 1.3;">${matchH1[1]}</h1>`);
      } else if (matchH2) {
        processedBlocks.push(`<h2 style="color: #00e5ff; font-size: 18px; margin-top: 20px; margin-bottom: 10px; font-weight: 600; line-height: 1.3;">${matchH2[1]}</h2>`);
      } else if (matchH3) {
        processedBlocks.push(`<h3 style="color: #00e5ff; font-size: 16px; margin-top: 18px; margin-bottom: 8px; font-weight: 600; line-height: 1.3;">${matchH3[1]}</h3>`);
      } else {
        processedBlocks.push(`<p style="color: #d1d5db; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 16px;">${parsedLine}</p>`);
      }
    }
  }
  if (inList) {
    processedBlocks.push('</ul>');
  }

  return processedBlocks.join('\n').replace(/(<br \/>\s*){2,}/g, '<br />');
}

// Helper: Wrap markdown blocks in TokenMarket's luxury dark-themed email template
function renderNotificationEmailHtml(subject: string, bodyMarkdown: string, unsubscribeUrl?: string, isAdministrative: boolean = false): string {
  const htmlContent = markdownToEmailHtml(bodyMarkdown);
  
  const footerText = isAdministrative
    ? `<span style="color: #00e5ff; font-weight: 600;">Critical System Update</span><br />
       You are receiving this essential operational update as a registered user of TokenMarket. Because this contains critical administrative information, unsubscribe settings do not apply.`
    : `You received this promotional communication because you opted in to TokenMarket updates.<br />
       <br />
       To unsubscribe or update your notification preferences, you can 
       <a href="${unsubscribeUrl}" style="color: #00e5ff; text-decoration: underline; font-weight: 500;">unsubscribe here</a> at any time.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050811; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050811; table-layout: fixed; width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0b0f19; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.6);">
          <!-- cyan neon header bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #00b4d8 0%, #00e5ff 50%, #00b4d8 100%); height: 4px; line-height: 4px; font-size: 0px;">&nbsp;</td>
          </tr>
          
          <!-- Header Area -->
          <tr>
            <td style="padding: 32px 40px 20px 40px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 1px; text-transform: uppercase;">
                      TOKEN<span style="color: #00e5ff;">MARKET</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 0;" />
            </td>
          </tr>
          
          <!-- Content Area -->
          <tr>
            <td style="padding: 40px 40px 32px 40px; text-align: left;">
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 24px; line-height: 1.3;">
                ${subject}
              </h1>
              <div style="color: #d1d5db; font-size: 14px; line-height: 1.6;">
                ${htmlContent}
              </div>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 0;" />
            </td>
          </tr>
          
          <!-- Footer Area -->
          <tr>
            <td style="padding: 32px 40px 40px 40px; background-color: #080c14; text-align: center;">
              <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0;">
                ${footerText}
              </p>
              <p style="font-size: 11px; color: #4b5563; margin-top: 24px; margin-bottom: 0;">
                &copy; 2026 Stillwater Suite. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Admin Route: Send custom system/marketing notifications to single or all users via email
router.post('/admin/send-notification', verifyAdmin, async (req: Request, res: Response) => {
  const { target, recipientEmail, subject, body, isAdministrative = false } = req.body;

  if (!target || !['all', 'single'].includes(target)) {
    return res.status(400).json({ error: 'Invalid target selection: must be "all" or "single"' });
  }

  if (target === 'single' && !recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail is required for single-user notifications.' });
  }

  if (!subject || !body) {
    return res.status(400).json({ error: 'Notification subject and body are required.' });
  }

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const tokenmarketDb = getFirestore(adminApp, 'tokenmarket-db-0');

    let docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] = [];

    if (target === 'single') {
      const userQuery = await tokenmarketDb.collection('users').where('email', '==', recipientEmail).get();
      if (userQuery.empty) {
        return res.status(404).json({ error: `User with email "${recipientEmail}" not found in TokenMarket registry.` });
      }
      docs = userQuery.docs;
    } else {
      const allUsersQuery = await tokenmarketDb.collection('users').get();
      docs = allUsersQuery.docs;
    }

    const results: Array<{ email: string; status: 'sent' | 'failed' | 'skipped'; reason?: string }> = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const doc of docs) {
      const data = doc.data();
      const email = data.email;
      if (!email) continue;

      const marketingOptIn = data.marketingEmailsEnabled !== false;

      // Skip promotional emails if the user has unsubscribed
      if (!isAdministrative && !marketingOptIn) {
        results.push({ email, status: 'skipped', reason: 'unsubscribed' });
        skippedCount++;
        continue;
      }

      try {
        const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/support/unsubscribe?email=${encodeURIComponent(email)}`;
        const html = renderNotificationEmailHtml(subject, body, unsubscribeUrl, isAdministrative);

        await EmailService.sendMail({
          from: '"TokenMarket Support" <support@fundingcloud.com>',
          to: email,
          subject: subject,
          text: body, // plain text fallback
          html: html
        });

        results.push({ email, status: 'sent' });
        sentCount++;
      } catch (err: any) {
        console.error(`[SupportAdmin] Failed to send email to ${email}:`, err.message);
        results.push({ email, status: 'failed', reason: err.message });
        failedCount++;
      }
    }

    // Return detailed administrative transmission log
    res.status(200).json({
      success: true,
      summary: {
        total: docs.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount
      },
      results
    });
  } catch (err: any) {
    console.error('[SupportAdmin] Send notification error:', err.message);
    res.status(500).json({ error: `Failed to process administrative communication: ${err.message}` });
  }
});

export default router;
