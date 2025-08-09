import { getDb } from './init';
import { Signal } from '../core/signalEngine';

export function persistSignal(signal: Signal) {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO signals(timestamp, symbol, timeframe, direction, price, confidence, reasons)
    VALUES(@timestamp, @symbol, @timeframe, @direction, @price, @confidence, @reasons)`);
  stmt.run({
    timestamp: signal.timestamp,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    direction: signal.direction,
    price: signal.price,
    confidence: signal.confidence,
    reasons: JSON.stringify(signal.reasons),
  });
}

export function fetchLatestSignals(limit = 50): Signal[] {
  const db = getDb();
  const rows = db.prepare(`SELECT timestamp, symbol, timeframe, direction, price, confidence, reasons
    FROM signals ORDER BY timestamp DESC LIMIT ?`).all(limit) as any[];
  return rows.map((r) => ({
    timestamp: r.timestamp,
    symbol: r.symbol,
    timeframe: r.timeframe,
    direction: r.direction,
    price: r.price,
    confidence: r.confidence,
    reasons: JSON.parse(r.reasons || '[]'),
  }));
}