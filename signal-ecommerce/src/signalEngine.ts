import { computeEma, computeRsi, computeMacd, computeAtr } from './indicators.js';
import { saveSignal } from './db.js';
import { logger } from './logger.js';

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number; closed: boolean };

export type SignalOutput = {
  direction: 'CALL' | 'PUT';
  price: number;
  score: number;
  reasons: string[];
};

export class SignalEngine {
  private emaFast: number;
  private emaSlow: number;
  private rsiPeriod: number;
  private macdFast: number;
  private macdSlow: number;
  private macdSignal: number;
  private atrPeriod: number;
  private confirmMultiTF: boolean;

  private historyByInterval: Map<string, Candle[]> = new Map();
  private symbol: string;

  constructor(symbol: string, intervals: string[], opts: {
    emaPeriods: [number, number];
    rsiPeriod: number;
    macd: { fast: number; slow: number; signal: number };
    atrPeriod: number;
    confirmMultiTF: boolean;
  }) {
    this.symbol = symbol;
    this.emaFast = opts.emaPeriods[0];
    this.emaSlow = opts.emaPeriods[1];
    this.rsiPeriod = opts.rsiPeriod;
    this.macdFast = opts.macd.fast;
    this.macdSlow = opts.macd.slow;
    this.macdSignal = opts.macd.signal;
    this.atrPeriod = opts.atrPeriod;
    this.confirmMultiTF = opts.confirmMultiTF;
    intervals.forEach(i => this.historyByInterval.set(i, []));
  }

  upsertCandle(interval: string, t: number, o: number, h: number, l: number, c: number, v: number, closed: boolean) {
    const arr = this.historyByInterval.get(interval)!;
    const last = arr[arr.length - 1];
    if (!last || last.t !== t) {
      arr.push({ t, o, h, l, c, v, closed });
    } else {
      last.o = o; last.h = h; last.l = l; last.c = c; last.v = v; last.closed = closed;
    }
    if (arr.length > 1000) arr.shift();

    if (closed) {
      const signal = this.tryGenerateSignal(interval);
      if (signal) {
        saveSignal({
          symbol: this.symbol,
          interval,
          timestamp: t,
          direction: signal.direction,
          price: signal.price,
          score: signal.score,
          details: JSON.stringify({ reasons: signal.reasons })
        });
        logger.info(`Signal ${signal.direction} ${this.symbol} ${interval} @${signal.price} score=${signal.score.toFixed(2)} reasons=${signal.reasons.join('|')}`);
      }
    }
  }

  private tryGenerateSignal(interval: string): SignalOutput | null {
    const candles = this.historyByInterval.get(interval)!;
    if (candles.length < Math.max(this.emaSlow + 2, this.rsiPeriod + 2, this.atrPeriod + 2, this.macdSlow + this.macdSignal)) return null;

    const closes = candles.map(c => c.c);
    const highs = candles.map(c => c.h);
    const lows = candles.map(c => c.l);

    const emaF = computeEma(closes, this.emaFast);
    const emaS = computeEma(closes, this.emaSlow);
    const rsi = computeRsi(closes, this.rsiPeriod);
    const macd = computeMacd(closes, this.macdFast, this.macdSlow, this.macdSignal);
    const atr = computeAtr(highs, lows, closes, this.atrPeriod);

    const lastIdx = closes.length - 1;
    const emaFLast = emaF[emaF.length - 1];
    const emaSLast = emaS[emaS.length - 1];
    const rsiLast = rsi[rsi.length - 1];
    const macdLast = macd[macd.length - 1];
    const macdPrev = macd[macd.length - 2];
    const atrLast = atr[atr.length - 1];

    const price = closes[lastIdx];
    const range = atrLast;

    let score = 0;
    const reasons: string[] = [];

    // Trend filter via EMA cross + slope
    const trendUp = emaFLast > emaSLast;
    const trendDown = emaFLast < emaSLast;

    const emaSlopeUp = emaFLast - emaF[emaF.length - 2] > 0;
    const emaSlopeDown = emaFLast - emaF[emaF.length - 2] < 0;

    // Momentum: RSI and MACD cross
    const macdCrossUp = macdPrev.MACD < macdPrev.signal && macdLast.MACD > macdLast.signal;
    const macdCrossDown = macdPrev.MACD > macdPrev.signal && macdLast.MACD < macdLast.signal;

    // Volatility guard: ATR relative to price
    const volOk = range / price > 0.0003 && range / price < 0.01;

    // Signal candidates
    let candidate: 'CALL' | 'PUT' | null = null;

    if (trendUp && emaSlopeUp && rsiLast > 50 && macdLast.MACD > macdLast.signal) {
      candidate = 'CALL';
      score += 1.5; reasons.push('trendUp');
      if (macdCrossUp) { score += 1; reasons.push('macdCrossUp'); }
      if (rsiLast < 70) { score += 0.5; reasons.push('rsiNotOverbought'); }
    }
    if (trendDown && emaSlopeDown && rsiLast < 50 && macdLast.MACD < macdLast.signal) {
      candidate = 'PUT';
      score += 1.5; reasons.push('trendDown');
      if (macdCrossDown) { score += 1; reasons.push('macdCrossDown'); }
      if (rsiLast > 30) { score += 0.5; reasons.push('rsiNotOversold'); }
    }

    if (!candidate) return null;

    if (!volOk) { reasons.push('volatilityGuardFail'); score -= 1; }

    // Multi-timeframe confirmation: require the higher timeframe trend agrees
    if (this.confirmMultiTF) {
      const higher = this.getHigherInterval(interval);
      if (higher) {
        const ok = this.confirmHigherTF(higher, candidate);
        if (!ok) { reasons.push('higherTfDisagree'); score -= 1.2; }
        else { reasons.push('higherTfAgree'); score += 0.8; }
      }
    }

    // Risk guard: price distance to EMA slow within 2*ATR
    const dist = Math.abs(price - emaSLast);
    if (dist > 2 * range) { reasons.push('tooFarFromMean'); score -= 0.8; }

    // Normalize score and threshold
    const normalized = Math.max(0, Math.min(5, score));
    if (normalized < 2.2) return null;

    return { direction: candidate, price, score: Number(normalized.toFixed(2)), reasons };
  }

  private getHigherInterval(interval: string): string | null {
    const order = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h'];
    const idx = order.indexOf(interval);
    if (idx === -1) return null;
    for (let i = idx + 1; i < order.length; i++) {
      if (this.historyByInterval.has(order[i])) return order[i];
    }
    return null;
  }

  private confirmHigherTF(interval: string, candidate: 'CALL' | 'PUT'): boolean {
    const candles = this.historyByInterval.get(interval)!;
    if (candles.length < this.emaSlow + 5) return true; // neutral
    const closes = candles.map(c => c.c);
    const emaF = computeEma(closes, this.emaFast);
    const emaS = computeEma(closes, this.emaSlow);
    const emaFLast = emaF[emaF.length - 1];
    const emaSLast = emaS[emaS.length - 1];
    if (candidate === 'CALL') return emaFLast >= emaSLast;
    return emaFLast <= emaSLast;
  }
}