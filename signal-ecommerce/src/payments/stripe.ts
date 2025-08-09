import Stripe from 'stripe';
import type { Request, Response } from 'express';
import { logger } from '../logger.js';
import { getDb } from '../db.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function createCheckoutSession(params: {
  userId: number;
  email: string;
  amountCents: number;
  currency: string;
  productName: string;
  serverBaseUrl: string;
}): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: params.email,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: { name: params.productName },
          unit_amount: params.amountCents
        },
        quantity: 1
      }
    ],
    metadata: { userId: String(params.userId) },
    success_url: `${params.serverBaseUrl}/success.html`,
    cancel_url: `${params.serverBaseUrl}/cancel.html`
  });
  if (!session.url) throw new Error('No checkout URL');
  return session.url;
}

export function stripeWebhookHandler(req: Request, res: Response) {
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body as any, sig as string, webhookSecret);
    } else {
      // Fallback: try parse JSON without verification (not recommended for prod)
      event = JSON.parse((req.body as Buffer).toString());
    }
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${String(err)}`);
    return res.status(400).send(`Webhook Error: ${String(err)}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ? Number(session.metadata.userId) : undefined;
      if (userId) {
        grantAccess(userId, 30);
      }
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const userId = pi.metadata?.userId ? Number(pi.metadata.userId) : undefined;
      if (userId) {
        grantAccess(userId, 30);
      }
      break;
    }
    default:
      // ignore other events
      break;
  }

  res.json({ received: true });
}

function grantAccess(userId: number, days: number) {
  const now = Date.now();
  const row = getDb().prepare('SELECT active_until FROM users WHERE id = ?').get(userId) as { active_until?: number } | undefined;
  const base = row?.active_until && row.active_until > now ? row.active_until : now;
  const newUntil = base + days * 24 * 60 * 60 * 1000;
  getDb().prepare('UPDATE users SET active_until = ? WHERE id = ?').run(newUntil, userId);
  logger.info(`Granted ${days} days to user ${userId}. Active until: ${newUntil}`);
}