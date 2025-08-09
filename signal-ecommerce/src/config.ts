import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import yaml from 'yaml';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  server: z.object({
    port: z.number().int().min(1).max(65535).default(3000),
    corsOrigins: z.array(z.string()).default(["*"])
  }),
  binance: z.object({
    symbolSpot: z.string().default('EURUSDT'),
    intervals: z.array(z.string()).default(['1m', '5m']),
    reconnectMs: z.number().int().default(5000)
  }),
  signals: z.object({
    emaPeriods: z.tuple([z.number(), z.number()]).default([9, 21]),
    rsiPeriod: z.number().default(14),
    macd: z.object({ fast: z.number().default(12), slow: z.number().default(26), signal: z.number().default(9) }).default({ fast: 12, slow: 26, signal: 9 }),
    atrPeriod: z.number().default(14),
    confirmMultiTF: z.boolean().default(true)
  }),
  security: z.object({
    jwtSecret: z.string(),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(8)
  }),
  payments: z.object({
    stripeSecretKey: z.string().optional(),
    currency: z.string().default('usd'),
    productName: z.string().default('EURUSD Signals Subscription'),
    priceMonthly: z.number().default(1999) // in cents
  }),
  database: z.object({
    file: z.string().default('data.sqlite')
  })
});

function loadYamlConfig(): Partial<z.infer<typeof ConfigSchema>> {
  const cfgPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config.yml');
  if (!fs.existsSync(cfgPath)) {
    return {};
  }
  const content = fs.readFileSync(cfgPath, 'utf8');
  const doc = yaml.parse(content);
  return doc || {};
}

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
  const yamlCfg = loadYamlConfig();
  const envCfg: Partial<AppConfig> = {
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : undefined,
      corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : undefined
    },
    binance: {
      symbolSpot: process.env.BINANCE_SYMBOL || undefined,
      intervals: process.env.BINANCE_INTERVALS ? process.env.BINANCE_INTERVALS.split(',') : undefined,
      reconnectMs: process.env.BINANCE_RECONNECT_MS ? Number(process.env.BINANCE_RECONNECT_MS) : undefined
    },
    signals: {
      emaPeriods: process.env.SIG_EMA ? (process.env.SIG_EMA.split(',').map(Number) as [number, number]) : undefined,
      rsiPeriod: process.env.SIG_RSI ? Number(process.env.SIG_RSI) : undefined,
      macd: (process.env.SIG_MACD_FAST || process.env.SIG_MACD_SLOW || process.env.SIG_MACD_SIGNAL) ? {
        fast: process.env.SIG_MACD_FAST ? Number(process.env.SIG_MACD_FAST) : undefined,
        slow: process.env.SIG_MACD_SLOW ? Number(process.env.SIG_MACD_SLOW) : undefined,
        signal: process.env.SIG_MACD_SIGNAL ? Number(process.env.SIG_MACD_SIGNAL) : undefined,
      } : undefined,
      atrPeriod: process.env.SIG_ATR ? Number(process.env.SIG_ATR) : undefined,
      confirmMultiTF: process.env.SIG_CONFIRM ? process.env.SIG_CONFIRM === 'true' : undefined
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD
    },
    payments: {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      currency: process.env.PAY_CURRENCY,
      productName: process.env.PAY_PRODUCT,
      priceMonthly: process.env.PAY_PRICE ? Number(process.env.PAY_PRICE) : undefined
    },
    database: {
      file: process.env.DB_FILE
    }
  } as Partial<AppConfig>;

  const merged = deepMerge(yamlCfg, envCfg);
  const parsed = ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error('Invalid configuration');
  }
  return parsed.data;
}

function deepMerge<T>(base: Partial<T>, override: Partial<T>): Partial<T> {
  const result: any = { ...(base as any) };
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge((result[key] || {}) as any, value as any);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}