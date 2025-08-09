# Signal E-commerce (EURUSD CALL/PUT via Binance WS)

Quick start:

1. Copy `.env.example` to `.env` and set secrets.
2. Optionally create `config.yml` (see `config.example.yml`).
3. Install and run dev server:

```
npm install
npm run dev
```

API:
- POST `/api/auth/register` { email, password }
- POST `/api/auth/login` { email, password }
- GET `/api/signals/recent?symbol=EURUSDT&limit=50` (Bearer + active subscription)
- POST `/api/admin/grant` { userId, days } (admin)

Signals are generated on kline close with EMA/RSI/MACD/ATR and multi-timeframe confirmation.