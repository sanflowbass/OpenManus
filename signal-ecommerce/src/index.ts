import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import { loadConfig } from './config.js';
import { initDb, createAdminIfMissing } from './db.js';
import { hashPassword } from './auth.js';
import { logger } from './logger.js';
import router from './routes.js';
import { BinanceStream } from './binanceStream.js';
import { SignalEngine } from './signalEngine.js';

async function main() {
  const cfg = loadConfig();
  initDb(cfg.database.file);
  const adminHash = await hashPassword(cfg.security.adminPassword);
  createAdminIfMissing(cfg.security.adminEmail, adminHash);

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: cfg.server.corsOrigins.includes('*') ? true : cfg.server.corsOrigins }));
  app.use(morgan('combined'));
  app.use(bodyParser.json());
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));

  app.use('/api', router);

  const server = app.listen(cfg.server.port, () => logger.info(`Server listening on :${cfg.server.port}`));

  // Streams and signal engine
  const stream = new BinanceStream(cfg.binance.symbolSpot, cfg.binance.intervals, cfg.binance.reconnectMs);
  const engine = new SignalEngine(cfg.binance.symbolSpot, cfg.binance.intervals, {
    emaPeriods: cfg.signals.emaPeriods,
    rsiPeriod: cfg.signals.rsiPeriod,
    macd: cfg.signals.macd,
    atrPeriod: cfg.signals.atrPeriod,
    confirmMultiTF: cfg.signals.confirmMultiTF
  });

  for (const interval of cfg.binance.intervals) {
    stream.on(interval, (k) => {
      const t = k.t; const o = Number(k.o); const h = Number(k.h); const l = Number(k.l); const c = Number(k.c); const v = Number(k.v);
      engine.upsertCandle(interval, t, o, h, l, c, v, k.x);
    });
  }
  stream.start();

  process.on('SIGINT', () => { server.close(() => process.exit(0)); });
}

main().catch((e) => { logger.error(String(e)); process.exit(1); });