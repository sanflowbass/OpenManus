import { Router } from 'express';
import Stripe from 'stripe';
import { config } from '../utils/config';
import { createOrGetCustomer, upsertSubscriptionByWebhook } from '../db/commerce';

export function createCommerceRouter(): Router {
  const router = Router();
  const stripe = config.commerce.stripeSecretKey ? new Stripe(config.commerce.stripeSecretKey) : null;

  router.get('/plans', (_req, res) => {
    res.json({ priceId: config.commerce.stripePriceId, currency: 'USD', interval: 'month' });
  });

  router.post('/checkout', async (req, res) => {
    if (!stripe || !config.commerce.stripePriceId || !config.commerce.successUrl || !config.commerce.cancelUrl) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    const { email } = req.body || {};
    const customer = createOrGetCustomer(email);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: config.commerce.stripePriceId, quantity: 1 }],
      success_url: config.commerce.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: config.commerce.cancelUrl,
      metadata: { local_customer_id: String(customer.id) },
    });
    res.json({ url: session.url });
  });

  router.post('/webhook', (req, res) => {
    if (!stripe || !config.commerce.stripeWebhookSecret) return res.status(500).end();
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody || JSON.stringify(req.body), sig, config.commerce.stripeWebhookSecret);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    upsertSubscriptionByWebhook(event);
    res.json({ received: true });
  });

  return router;
}