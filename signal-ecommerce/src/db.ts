import Database from 'better-sqlite3';
import { logger } from './logger.js';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  stripeCustomerId?: string | null;
  activeUntil?: number | null; // epoch ms
}

export interface Signal {
  id: number;
  symbol: string;
  interval: string;
  timestamp: number; // open time
  direction: 'CALL' | 'PUT';
  price: number;
  score: number; // confidence
  details: string; // json
}

let db: Database.Database | null = null;

export function initDb(file: string): void {
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      stripe_customer_id TEXT,
      active_until INTEGER
    );
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      direction TEXT NOT NULL,
      price REAL NOT NULL,
      score REAL NOT NULL,
      details TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_signals_symbol_time ON signals(symbol, timestamp);
  `);
  logger.info('Database initialized');
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function createAdminIfMissing(email: string, passwordHash: string): void {
  const row = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id?: number } | undefined;
  if (!row) {
    getDb().prepare('INSERT INTO users(email, password_hash, role) VALUES (?, ?, ?)').run(email, passwordHash, 'admin');
    logger.info('Admin user created');
  }
}

export function saveSignal(sig: Omit<Signal, 'id'>): void {
  getDb().prepare(`
    INSERT INTO signals(symbol, interval, timestamp, direction, price, score, details)
    VALUES (@symbol, @interval, @timestamp, @direction, @price, @score, @details)
  `).run(sig);
}

export function listSignals(symbol: string, limit: number): Signal[] {
  const rows = getDb().prepare(`
    SELECT id, symbol, interval, timestamp, direction, price, score, details
    FROM signals WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?
  `).all(symbol, limit) as any[];
  return rows.map(r => ({
    id: r.id,
    symbol: r.symbol,
    interval: r.interval,
    timestamp: r.timestamp,
    direction: r.direction,
    price: r.price,
    score: r.score,
    details: r.details
  }));
}