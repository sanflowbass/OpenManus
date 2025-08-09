import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createSignalRouter } from './api/signals';
import { initializeDatabases } from './db/init';
import { createCommerceRouter } from './api/commerce';

dotenv.config();

const app = express();
app.use(cors());

// Stripe webhook precisa de raw body
app.post('/commerce/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  next();
});

app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/signals', createSignalRouter());
app.use('/commerce', createCommerceRouter());

const PORT = Number(process.env.PORT || 3000);

initializeDatabases()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('[server] failed to init databases', error);
    process.exit(1);
  });