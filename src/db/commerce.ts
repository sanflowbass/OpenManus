import { getDb } from './init';
import crypto from 'crypto';
import Stripe from 'stripe';

export type Customer = { id: number; email: string; stripeCustomerId?: string; apiKey: string };

export function createOrGetCustomer(email: string): Customer {
  const db = getDb();
  const row = db.prepare('SELECT id, email, stripe_customer_id as stripeCustomerId, api_key as apiKey FROM customers WHERE email = ?').get(email) as any;
  if (row) return row as Customer;
  const apiKey = crypto.randomBytes(24).toString('hex');
  const info = db.prepare('INSERT INTO customers(email, api_key, created_at) VALUES(?, ?, ?)').run(email, apiKey, Date.now());
  return { id: Number(info.lastInsertRowid), email, apiKey } as Customer;
}

export function getCustomerByApiKey(apiKey: string): Customer | null {
  const db = getDb();
  const row = db.prepare('SELECT id, email, stripe_customer_id as stripeCustomerId, api_key as apiKey FROM customers WHERE api_key = ?').get(apiKey) as any;
  return row || null;
}

export function upsertSubscriptionByWebhook(event: Stripe.Event) {
  const db = getDb();
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const localId = Number(session.metadata?.local_customer_id || 0);
      if (localId) {
        db.prepare('UPDATE customers SET stripe_customer_id = ? WHERE id = ?').run(session.customer as string, localId);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.status;
      const stripeCustomerId = (sub.customer as string) || '';
      const currentPeriodEnd = ((sub as any).current_period_end || 0) * 1000;
      const cust = db.prepare('SELECT id FROM customers WHERE stripe_customer_id = ?').get(stripeCustomerId) as any;
      if (cust) {
        db.prepare('INSERT INTO subscriptions(customer_id, stripe_subscription_id, status, current_period_end) VALUES(?, ?, ?, ?) ON CONFLICT(stripe_subscription_id) DO UPDATE SET status=excluded.status, current_period_end=excluded.current_period_end')
          .run(cust.id, sub.id, status, currentPeriodEnd);
      }
      break;
    }
    default:
      break;
  }
}