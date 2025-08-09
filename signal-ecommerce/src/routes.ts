import { Router } from 'express';
import { authMiddleware, createToken, hashPassword, verifyPassword, requireActiveSubscription } from './auth.js';
import { getDb, listSignals } from './db.js';
import { createCheckoutSession } from './payments/stripe.js';

const router = Router();

router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'missing email/password' });
  const existing = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'email exists' });
  const hash = await hashPassword(password);
  const info = getDb().prepare('INSERT INTO users(email, password_hash, role) VALUES (?, ?, ?)').run(email, hash, 'user');
  const token = createToken({ sub: Number(info.lastInsertRowid), email, role: 'user' });
  res.json({ token });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'missing email/password' });
  const row = getDb().prepare('SELECT id, password_hash, role FROM users WHERE email = ?').get(email) as any;
  if (!row) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = createToken({ sub: row.id, email, role: row.role });
  res.json({ token });
});

router.get('/signals/recent', authMiddleware(), requireActiveSubscription, (req, res) => {
  const { symbol = 'EURUSDT', limit = '50' } = req.query as any;
  const list = listSignals(String(symbol), Number(limit));
  res.json(list);
});

router.get('/health', (_req, res) => res.json({ ok: true }));

router.post('/admin/grant', authMiddleware(true), (req, res) => {
  const { userId, days } = req.body as { userId?: number; days?: number };
  if (!userId || !days) return res.status(400).json({ error: 'missing userId/days' });
  const now = Date.now();
  const row = getDb().prepare('SELECT active_until FROM users WHERE id = ?').get(userId) as { active_until?: number } | undefined;
  const base = row?.active_until && row.active_until > now ? row.active_until : now;
  const newUntil = base + days * 24 * 60 * 60 * 1000;
  getDb().prepare('UPDATE users SET active_until = ? WHERE id = ?').run(newUntil, userId);
  res.json({ userId, activeUntil: newUntil });
});

router.post('/payments/checkout', authMiddleware(), async (req, res) => {
  try {
    const user = (req as any).user as { sub: number; email: string };
    const amount = Number(process.env.PAY_PRICE || '1999');
    const currency = process.env.PAY_CURRENCY || 'usd';
    const productName = process.env.PAY_PRODUCT || 'EURUSD Signals Subscription';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = await createCheckoutSession({
      userId: user.sub,
      email: user.email,
      amountCents: amount,
      currency,
      productName,
      serverBaseUrl: baseUrl
    });
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;