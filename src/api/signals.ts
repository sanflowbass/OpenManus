import { Router } from 'express';
import { getSignalEngine } from '../core/signalEngine';
import { config } from '../utils/config';
import { getCustomerByApiKey } from '../db/commerce';

export function createSignalRouter(): Router {
  const router = Router();
  const engine = getSignalEngine();

  router.get('/', (_req, res) => {
    const latest = engine.getLatestSignals(50);
    res.json(latest);
  });

  router.get('/sse', (req, res) => {
    if (config.commerce.requireApiKey) {
      const apiKey = (req.query.apiKey as string) || (req.headers['x-api-key'] as string);
      if (!apiKey || !getCustomerByApiKey(apiKey)) {
        return res.status(401).end();
      }
    }

    // Keep raw body disabled for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const unsubscribe = engine.subscribe(send);

    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  });

  router.post('/backtest', async (req, res) => {
    const { length = 500 } = req.body || {};
    const report = await engine.runBacktest({ length });
    res.json(report);
  });

  return router;
}