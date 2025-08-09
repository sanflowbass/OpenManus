import { MACD, RSI, EMA } from 'technicalindicators';
import { getMarketService, Candle } from '../services/market';
import { persistSignal, fetchLatestSignals } from '../db/signals';
import { config } from '../utils/config';

type MacdLike = { MACD?: number; signal?: number; histogram?: number };

export type Signal = {
  timestamp: number;
  symbol: string;
  timeframe: string;
  direction: 'CALL' | 'PUT';
  price: number;
  confidence: number;
  reasons: string[];
};

class SignalEngine {
  private subscribers: Set<(s: Signal) => void> = new Set();
  private market = getMarketService();

  constructor() {
    this.market.on('candle', (tf, candle) => {
      if (tf === config.timeframe) {
        const signal = this.evaluateSignals(tf, candle);
        if (signal) {
          persistSignal(signal);
          this.broadcast(signal);
        }
      }
    });
  }

  subscribe(cb: (s: Signal) => void) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  broadcast(signal: Signal) {
    for (const cb of this.subscribers) cb(signal);
  }

  getLatestSignals(limit = 50): Signal[] {
    return fetchLatestSignals(limit);
  }

  private evaluateSignals(timeframe: string, candle: Candle): Signal | null {
    const history = this.market.getHistory(config.timeframe, 200);
    if (history.length < 50) return null;

    const closes = history.map((c) => c.close);
    const volumes = history.map((c) => c.volume);

    const emaFast = EMA.calculate({ period: config.indicators.emaFast, values: closes });
    const emaSlow = EMA.calculate({ period: config.indicators.emaSlow, values: closes });
    const rsi = RSI.calculate({ period: config.indicators.rsiPeriod, values: closes });
    const macd = MACD.calculate({ values: closes, fastPeriod: config.indicators.macd.fast, slowPeriod: config.indicators.macd.slow, signalPeriod: config.indicators.macd.signal, SimpleMAOscillator: false, SimpleMASignal: false });

    const lastIdx = closes.length - 1;
    const lastPrice = closes[lastIdx] ?? null;

    const emaFastLast = emaFast[emaFast.length - 1];
    const emaSlowLast = emaSlow[emaSlow.length - 1];
    const rsiLast = rsi[rsi.length - 1];
    const macdLast: MacdLike | undefined = macd[macd.length - 1];

    if (lastPrice == null || emaFastLast == null || emaSlowLast == null || rsiLast == null || macdLast == null) return null;

    const atrVolatility = this.estimateVolatility(history);
    const volumeOk = this.zscoreOk(volumes, config.indicators.volumeZThreshold);

    let direction: 'CALL' | 'PUT' | null = null;
    const reasons: string[] = [];

    const macdAbove = (macdLast.MACD ?? 0) > (macdLast.signal ?? 0);
    const macdBelow = (macdLast.MACD ?? 0) < (macdLast.signal ?? 0);

    if (emaFastLast > emaSlowLast && rsiLast > 50 && macdAbove) {
      direction = 'CALL';
      reasons.push('EMAfast>EMAslow', 'RSI>50', 'MACD>Signal');
    } else if (emaFastLast < emaSlowLast && rsiLast < 50 && macdBelow) {
      direction = 'PUT';
      reasons.push('EMAfast<EMAslow', 'RSI<50', 'MACD<Signal');
    }

    if (!direction) return null;

    if (!volumeOk) return null;
    if (atrVolatility < config.indicators.minVolatility) return null;

    const confidence = this.computeConfidence({
      rsiLast,
      emaFastLast,
      emaSlowLast,
      macdLast,
      atrVolatility,
      volumeOk,
    });

    return {
      timestamp: candle.closeTime,
      symbol: config.symbol.toUpperCase(),
      timeframe,
      direction,
      price: lastPrice,
      confidence,
      reasons,
    };
  }

  private computeConfidence(params: { rsiLast: number; emaFastLast: number; emaSlowLast: number; macdLast: MacdLike; atrVolatility: number; volumeOk: boolean; }): number {
    let score = 0;
    if (params.volumeOk) score += 0.2;
    const rsiDistance = Math.abs(params.rsiLast - 50) / 50;
    score += Math.min(0.3, rsiDistance * 0.3);
    const emaDistance = Math.abs(params.emaFastLast - params.emaSlowLast) / Math.max(params.emaSlowLast, 1e-8);
    score += Math.min(0.3, emaDistance * 3);
    const macdStrength = Math.abs(params.macdLast.histogram ?? 0);
    score += Math.min(0.2, macdStrength);
    return Number(Math.min(0.99, Math.max(0.01, score)).toFixed(2));
  }

  private estimateVolatility(history: Candle[]): number {
    if (history.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1]!;
      const curr = history[i]!;
      const ret = Math.abs(curr.close - prev.close) / prev.close;
      sum += ret;
    }
    return sum / Math.max(1, history.length - 1);
  }

  private zscoreOk(series: number[], threshold = 0.0): boolean {
    const window = series.slice(-30);
    if (window.length === 0) return false;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length;
    const std = Math.sqrt(variance) || 1e-8;
    const last = window[window.length - 1]!;
    const z = (last - mean) / std;
    return z >= threshold;
  }

  async runBacktest(opts: { length: number }) {
    const candles = this.market.getHistory(config.timeframe, Math.max(300, opts.length));
    const signals: Signal[] = [];
    for (let i = 50; i < candles.length; i++) {
      const sig = this.evaluateSignals(config.timeframe, candles[i]!);
      if (sig) signals.push(sig);
    }
    let wins = 0;
    for (let i = 0; i < signals.length; i++) {
      const idx = candles.findIndex((c) => c.closeTime === signals[i]!.timestamp);
      if (idx < 0) continue;
      const next = candles[idx + 3] || candles[idx + 1];
      if (next) {
        const change = next.close - candles[idx]!.close;
        if ((signals[i]!.direction === 'CALL' && change > 0) || (signals[i]!.direction === 'PUT' && change < 0)) {
          wins++;
        }
      }
    }
    return {
      totalSignals: signals.length,
      winRate3: signals.length ? Number((wins / signals.length).toFixed(3)) : 0,
      sample: signals.slice(-10),
    };
  }
}

let engine: SignalEngine | null = null;
export function getSignalEngine(): SignalEngine {
  if (!engine) engine = new SignalEngine();
  return engine;
}