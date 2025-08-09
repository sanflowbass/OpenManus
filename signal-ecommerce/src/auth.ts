import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getDb } from './db.js';

const JWT_TTL = '7d';

export interface JwtPayload {
  sub: number;
  email: string;
  role: 'admin' | 'user';
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET as string;
  return jwt.sign(payload, secret, { expiresIn: JWT_TTL });
}

export function authMiddleware(requireAdmin = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'missing auth header' });
    const token = header.replace('Bearer ', '').trim();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      (req as any).user = decoded;
      if (requireAdmin && decoded.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
      next();
    } catch (err) {
      return res.status(401).json({ error: 'invalid token' });
    }
  };
}

export function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JwtPayload | undefined;
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const row = getDb().prepare('SELECT active_until FROM users WHERE id = ?').get(user.sub) as { active_until?: number } | undefined;
  const now = Date.now();
  if (!row?.active_until || row.active_until < now) return res.status(402).json({ error: 'subscription expired' });
  next();
}