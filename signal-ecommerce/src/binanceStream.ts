import WebSocket from 'ws';
import { logger } from './logger.js';

export type Kline = {
  t: number; // start time
  T: number; // end time
  s: string; // symbol
  i: string; // interval
  o: string; // open
  c: string; // close
  h: string; // high
  l: string; // low
  v: string; // volume
  x: boolean; // isClosed
};

export type KlineEvent = { e: 'kline'; E: number; s: string; k: Kline };

export type KlineHandler = (k: Kline) => void;

export class BinanceStream {
  private symbol: string;
  private intervals: string[];
  private reconnectMs: number;
  private sockets: Map<string, WebSocket> = new Map();
  private listeners: Map<string, Set<KlineHandler>> = new Map();

  constructor(symbol: string, intervals: string[], reconnectMs: number) {
    this.symbol = symbol.toLowerCase();
    this.intervals = intervals;
    this.reconnectMs = reconnectMs;
  }

  on(interval: string, handler: KlineHandler) {
    const key = interval;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(handler);
  }

  off(interval: string, handler: KlineHandler) {
    this.listeners.get(interval)?.delete(handler);
  }

  start() {
    for (const interval of this.intervals) {
      this.connectInterval(interval);
    }
  }

  private connectInterval(interval: string) {
    const streamUrl = `wss://stream.binance.com:9443/ws/${this.symbol}@kline_${interval}`;
    const ws = new WebSocket(streamUrl);
    this.sockets.set(interval, ws);

    ws.on('open', () => logger.info(`Binance WS connected ${this.symbol} ${interval}`));
    ws.on('close', () => {
      logger.warn(`Binance WS closed ${this.symbol} ${interval}, reconnecting in ${this.reconnectMs}ms`);
      setTimeout(() => this.connectInterval(interval), this.reconnectMs);
    });
    ws.on('error', (err) => logger.error(`Binance WS error ${interval}: ${String(err)}`));
    ws.on('message', (data) => {
      try {
        const evt = JSON.parse(String(data)) as KlineEvent;
        if (evt.e !== 'kline') return;
        const kline = evt.k;
        this.listeners.get(interval)?.forEach((h) => h(kline));
      } catch (e) {
        logger.error(`Failed to parse message: ${String(e)}`);
      }
    });
  }
}