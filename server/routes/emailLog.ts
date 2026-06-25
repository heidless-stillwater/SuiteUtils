// Email log viewer route – returns recent fallback email log entries (authenticated)
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { adminAuth } from '../services/FirebaseAdmin.js';

const router = express.Router();

// Reuse same auth verification middleware as support router
async function verifyAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    (req as any).userId = decoded.uid;
    next();
  } catch (err: any) {
    console.error('[EmailLogAuth] token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(verifyAuth);

// GET /email-log – returns last N entries (default 20)
router.get('/email-log', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 20;
  const logPath = path.join(process.cwd(), 'logs', 'email_inbox.json');
  try {
    if (!fs.existsSync(logPath)) {
      return res.json({ entries: [] });
    }
    const raw = fs.readFileSync(logPath, 'utf8');
    const all = JSON.parse(raw) as any[];
    const recent = all.slice(-limit).reverse(); // newest first
    res.json({ entries: recent });
  } catch (err: any) {
    console.error('[EmailLog] read error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
