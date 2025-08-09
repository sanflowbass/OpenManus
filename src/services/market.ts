import WebSocket from 'ws';
import EventEmitter from 'events';
import { config } from '../utils/config';

type Timeframe = '1m';
export type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

class MarketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private symbol = config.symbol; // lower-case
  private tf: Timeframe = config.timeframe;
  private candles: Candle[] = [];
  private current: Candle | null = null;

  constructor() {
    super();
    this.connect();
  }

  private connect() {
    const url = `wss://stream.binance.com:9443/ws/${this.symbol}@kline_${this.tf}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log(`[market] connected to Binance WS ${this.symbol} ${this.tf}`);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg && msg.k) {
          const k = msg.k; // kline payload
          const candle: Candle = {
            openTime: k.t,
            closeTime: k.T,
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          };

          if (k.x) {
            this.candles.push(candle);
            if (this.candles.length > 5000) this.candles.shift();
            this.current = null;
            this.emit('candle', this.tf, candle);
          } else {
            this.current = candle;
          }
        }
      } catch (e) {
        console.error('[market] message parse error', e);
      }
    });

    this.ws.on('close', () => {
      console.warn('[market] ws closed, reconnecting in 2s');
      setTimeout(() => this.connect(), 2000);
    });

    this.ws.on('error', (err: any) => {
      console.error('[market] ws error', err);
      this.ws?.close();
    });
  }

  getHistory(tf: Timeframe, length: number): Candle[] {
    if (tf !== this.tf) throw new Error('unsupported timeframe');
    const arr = this.candles.slice(-length);
    return arr;
  }
}

let service: MarketService | null = null;
export function getMarketService(): MarketService {
  if (!service) service = new MarketService();
  return service;
}

export { Timeframe };