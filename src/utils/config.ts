import dotenv from 'dotenv';
dotenv.config();

export type AppConfig = {
  port: number;
  dbPath: string;
  symbol: string; // binance symbol e.g., EURUSDT
  timeframe: '1m';
  indicators: {
    emaFast: number;
    emaSlow: number;
    rsiPeriod: number;
    macd: { fast: number; slow: number; signal: number };
    minVolatility: number;
    volumeZThreshold: number;
  };
  commerce: {
    stripeSecretKey?: string | undefined;
    stripePriceId?: string | undefined;
    stripeWebhookSecret?: string | undefined;
    successUrl?: string | undefined;
    cancelUrl?: string | undefined;
    requireApiKey: boolean;
  };
};

export const config: AppConfig = {
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || './data.sqlite',
  symbol: (process.env.SYMBOL || 'EURUSDT').toLowerCase(),
  timeframe: '1m',
  indicators: {
    emaFast: Number(process.env.EMA_FAST || 9),
    emaSlow: Number(process.env.EMA_SLOW || 21),
    rsiPeriod: Number(process.env.RSI_PERIOD || 14),
    macd: {
      fast: Number(process.env.MACD_FAST || 12),
      slow: Number(process.env.MACD_SLOW || 26),
      signal: Number(process.env.MACD_SIGNAL || 9),
    },
    minVolatility: Number(process.env.MIN_VOLATILITY || 0.0001),
    volumeZThreshold: Number(process.env.VOLUME_Z || 0.0),
  },
  commerce: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripePriceId: process.env.STRIPE_PRICE_ID,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    successUrl: process.env.PUBLIC_SUCCESS_URL,
    cancelUrl: process.env.PUBLIC_CANCEL_URL,
    requireApiKey: String(process.env.REQUIRE_API_KEY || 'false').toLowerCase() === 'true',
  },
};