import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const modPath = join(root, 'src/payment-reconciliation.js');

async function loadModule() {
  return import(`${pathToFileURL(modPath).href}?test=${Date.now()}-${Math.random()}`);
}

test('P10 reconciliation module and webhook migration exist', () => {
  assert.ok(existsSync(modPath));
  assert.ok(existsSync(join(root, 'migrations/0004_webhook_events.sql')));
});

test('Stripe signature parser and verifier accept a valid TEST webhook and reject stale/tampered signatures', async () => {
  const { verifyStripeWebhookSignature } = await loadModule();
  const secret = 'whsec_test_only_example';
  const raw = JSON.stringify({ id: 'evt_test_1', type: 'payment_intent.succeeded' });
  const timestamp = 1788120000;
  const bytes = new TextEncoder().encode(`${timestamp}.${raw}`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal((await verifyStripeWebhookSignature(raw, header, secret, timestamp + 10)).ok, true);
  assert.equal((await verifyStripeWebhookSignature(`${raw}x`, header, secret, timestamp + 10)).ok, false);
  assert.equal((await verifyStripeWebhookSignature(raw, header, secret, timestamp + 1000)).error, 'stripe_signature_stale');
});

test('PayPal webhook verifier is Sandbox-only and sends the required verification fields', async () => {
  const { verifyPayPalWebhookSignature } = await loadModule();
  let calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return new Response(JSON.stringify({ access_token: 'sandbox-token' }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const event = { id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-1' } };
  const headers = new Headers({
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/certs/test',
    'paypal-transmission-id': 'tx-1',
    'paypal-transmission-sig': 'sig-1',
    'paypal-transmission-time': '2026-08-30T20:00:00Z',
  });
  assert.equal((await verifyPayPalWebhookSignature(event, headers, { mode: 'live', clientId: 'x', clientSecret: 'y', webhookId: 'wh', fetchImpl })).error, 'paypal_sandbox_mode_required');
  const verified = await verifyPayPalWebhookSignature(event, headers, { mode: 'sandbox', clientId: 'id', clientSecret: 'secret', webhookId: 'wh-test', fetchImpl });
  assert.equal(verified.ok, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /api-m\.sandbox\.paypal\.com\/v1\/oauth2\/token/);
  assert.match(calls[1].url, /api-m\.sandbox\.paypal\.com\/v1\/notifications\/verify-webhook-signature/);
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.webhook_id, 'wh-test');
  assert.equal(body.transmission_id, 'tx-1');
  assert.deepEqual(body.webhook_event, event);
});

test('supported provider events normalize exact payment identity, order, amount, and currency', async () => {
  const { normalizeProviderEvent } = await loadModule();
  const stripe = normalizeProviderEvent('STRIPE', {
    id: 'evt_1', type: 'payment_intent.succeeded', livemode: false,
    data: { object: { id: 'pi_1', amount: 2599, amount_received: 2599, currency: 'usd', metadata: { order_id: 'order-1' } } },
  });
  assert.deepEqual(stripe, { ok: true, provider: 'STRIPE', event_id: 'evt_1', event_type: 'payment_intent.succeeded', outcome: 'SUCCEEDED', provider_payment_id: 'pi_1', order_id: 'order-1', amount_cents: 2599, currency: 'USD' });

  const paypal = normalizeProviderEvent('PAYPAL', {
    id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'CAP-1', status: 'COMPLETED', amount: { value: '25.99', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: 'PP-ORDER-1' } }, custom_id: 'order-1' },
  });
  assert.equal(paypal.ok, true);
  assert.equal(paypal.provider_payment_id, 'CAP-1');
  assert.equal(paypal.amount_cents, 2599);
  assert.equal(paypal.currency, 'USD');
});

test('unsupported, live Stripe, malformed amount, and untrusted PayPal events cannot reconcile', async () => {
  const { normalizeProviderEvent } = await loadModule();
  assert.equal(normalizeProviderEvent('STRIPE', { id: 'e', type: 'payment_intent.succeeded', livemode: true, data: { object: {} } }).error, 'stripe_test_event_required');
  assert.equal(normalizeProviderEvent('STRIPE', { id: 'e', type: 'charge.succeeded', livemode: false }).error, 'unsupported_event');
  assert.equal(normalizeProviderEvent('PAYPAL', { id: 'e', event_type: 'CHECKOUT.ORDER.APPROVED', resource: {} }).error, 'unsupported_event');
  assert.equal(normalizeProviderEvent('PAYPAL', { id: 'e', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'c', amount: { value: '1.001', currency_code: 'USD' } } }).error, 'invalid_event_amount');
});

test('webhook ledger is replay-safe and append-only', () => {
  const sql = readFileSync(join(root, 'migrations/0004_webhook_events.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS webhook_events/i);
  assert.match(sql, /UNIQUE\s*\(\s*provider\s*,\s*provider_event_id\s*\)/i);
  assert.match(sql, /payload_hash/i);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)/i);
});

test('Worker exposes Stripe and PayPal webhook routes', () => {
  const worker = readFileSync(join(root, 'src/worker.js'), 'utf8');
  assert.match(worker, /\/api\/webhooks\/stripe/);
  assert.match(worker, /\/api\/webhooks\/paypal/);
  assert.match(worker, /handlePaymentWebhook/);
});

test('reconciliation source contains guarded success/failure transitions and never trusts browser state', () => {
  const source = readFileSync(modPath, 'utf8');
  assert.match(source, /provider_payment_id/);
  assert.match(source, /amount_cents/);
  assert.match(source, /payment_status\s*=\s*'PAID'/);
  assert.match(source, /order_status\s*=\s*'PAID'/);
  assert.match(source, /status\s*=\s*'CONSUMED'/);
  assert.match(source, /quantity\s*=\s*quantity\s*-/);
  assert.match(source, /payment_status\s*=\s*'FAILED'/);
  assert.doesNotMatch(source, /subtotal_cents\s*=\s*body/i);
});
