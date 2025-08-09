import { EMA, RSI, MACD, ATR } from 'technicalindicators';

export function computeEma(values: number[], period: number): number[] {
  return EMA.calculate({ period, values });
}

export function computeRsi(values: number[], period: number): number[] {
  return RSI.calculate({ period, values });
}

export function computeMacd(values: number[], fast: number, slow: number, signal: number) {
  return MACD.calculate({ values, fastPeriod: fast, slowPeriod: slow, signalPeriod: signal, SimpleMAOscillator: false, SimpleMASignal: false });
}

export function computeAtr(high: number[], low: number[], close: number[], period: number): number[] {
  return ATR.calculate({ high, low, close, period });
}