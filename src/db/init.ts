import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('db not initialized');
  return db;
}

export async function initializeDatabases(): Promise<void> {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      direction TEXT NOT NULL,
      price REAL NOT NULL,
      confidence REAL NOT NULL,
      reasons TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(timestamp);

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      stripe_customer_id TEXT,
      api_key TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      stripe_subscription_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);
}