// support router – provides ticket creation and retrieval (authenticated)
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import TicketStore from '../services/TicketStore.js';
import EmailService from '../services/EmailService.js';
import { adminAuth, suiteDb } from '../services/FirebaseAdmin.js';

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
  const ticketId = req.params.id;
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

export default router;
