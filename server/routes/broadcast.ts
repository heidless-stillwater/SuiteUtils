import express, { Request, Response } from 'express';
import { adminAuth, suiteDb } from '../services/FirebaseAdmin.js';
import { BroadcastService } from '../services/BroadcastService.js';

const router = express.Router();

// Helper middleware to verify admin privileges
async function verifyAdmin(req: Request, res: Response, next: Function) {
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

    console.log('[BroadcastAuthDebug] Decoded User:', { email, uid, isListed: adminEmails.includes(email.toLowerCase()), adminEmails });

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

    res.status(403).json({ error: 'Forbidden: Admin access required' });
  } catch (err: any) {
    console.error('[BroadcastRouteAuth] admin verification failed:', err.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

/**
 * POST /api/admin/broadcast/preview
 * Returns estimated recipient count for a given target and category (filtering marketing opt-outs).
 */
router.post('/preview', verifyAdmin, async (req: Request, res: Response) => {
  const { recipientTarget, category } = req.body;

  if (!recipientTarget) {
    return res.status(400).json({ error: 'recipientTarget is required' });
  }
  if (!category || !['system', 'marketing', 'policy'].includes(category)) {
    return res.status(400).json({ error: 'Invalid or missing category' });
  }

  try {
    const count = await BroadcastService.previewRecipientCount(recipientTarget, category);
    res.status(200).json({ success: true, count });
  } catch (err: any) {
    console.error('[BroadcastRoute] Preview error:', err.message);
    res.status(500).json({ error: `Failed to estimate recipient count: ${err.message}` });
  }
});

/**
 * POST /api/admin/broadcast/send
 * Creates a broadcast entry in Firestore and dispatches/queues it.
 */
router.post('/send', verifyAdmin, async (req: Request, res: Response) => {
  const { subject, category, from, body, templateKey, recipientTarget, scheduledAt } = req.body;

  if (!subject || !category || !from || !body || !templateKey || !recipientTarget) {
    return res.status(400).json({ error: 'Missing required broadcast fields (subject, category, from, body, templateKey, recipientTarget)' });
  }

  try {
    const broadcastId = await BroadcastService.sendOrQueueBroadcast({
      subject,
      category,
      from,
      body,
      templateKey,
      recipientTarget,
      scheduledAt,
      createdBy: (req as any).userId
    });

    res.status(200).json({ success: true, id: broadcastId });
  } catch (err: any) {
    console.error('[BroadcastRoute] Send/Queue error:', err.message);
    res.status(500).json({ error: `Failed to schedule/send broadcast: ${err.message}` });
  }
});

/**
 * GET /api/admin/broadcast/history
 * Returns paginated/listed broadcast history, sorted descending by creation time.
 */
router.get('/history', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const broadcastsSnap = await suiteDb.collection('broadcasts')
      .orderBy('createdAt', 'desc')
      .limit(100) // safety limit
      .get();

    const broadcasts = broadcastsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ success: true, broadcasts });
  } catch (err: any) {
    console.error('[BroadcastRoute] Get history error:', err.message);
    res.status(500).json({ error: `Failed to fetch broadcast history: ${err.message}` });
  }
});

/**
 * GET /api/admin/broadcast/history/:id/recipients
 * Returns the delivery log per recipient for a specific broadcast.
 */
router.get('/history/:id/recipients', verifyAdmin, async (req: Request, res: Response) => {
  const broadcastId = req.params.id;

  try {
    const recipientsSnap = await suiteDb.collection('broadcast_log')
      .doc(broadcastId)
      .collection('recipients')
      .get();

    const recipients = recipientsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ success: true, recipients });
  } catch (err: any) {
    console.error('[BroadcastRoute] Get recipients error:', err.message);
    res.status(500).json({ error: `Failed to fetch recipient logs: ${err.message}` });
  }
});

export default router;
