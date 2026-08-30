import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

async function paypal() {
  return import('../src/paypal-checkout.js');
}

test('P9 PayPal module exposes Sandbox auth, value, create, capture, and capture-input helpers', async () => {
  assert.ok(existsSync(join(root, 'src/paypal-checkout.js')));
  const mod = await paypal();
  for (const name of ['centsToPayPalValue', 'getPayPalAccessToken', 'createPayPalOrder', 'capturePayPalOrder', 'validatePayPalCaptureInput']) {
    assert.equal(typeof mod[name], 'function', `${name} should be exported`);
  }
});

test('PayPal integer cents format exactly as USD decimal strings', async () => {
  const { centsToPayPalValue } = await paypal();
  assert.equal(centsToPayPalValue(1234), '12.34');
  assert.equal(centsToPayPalValue(99), '0.99');
  assert.equal(centsToPayPalValue(1200), '12.00');
  assert.equal(centsToPayPalValue(0), '0.00');
  assert.equal(centsToPayPalValue(-1), null);
  assert.equal(centsToPayPalValue(1.5), null);
});

test('PayPal OAuth refuses non-Sandbox configuration before network access', async () => {
  const { getPayPalAccessToken } = await paypal();
  let calls = 0;
  const fakeFetch = async () => { calls += 1; return new Response('{}'); };
  const result = await getPayPalAccessToken({ mode: 'live', clientId: 'id', clientSecret: 'secret', fetchImpl: fakeFetch });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'paypal_sandbox_mode_required');
  assert.equal(calls, 0);
});

test('PayPal OAuth uses Sandbox client credentials flow', async () => {
  const { getPayPalAccessToken } = await paypal();
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ access_token: 'access-token', token_type: 'Bearer', expires_in: 32400 }), { status: 200 });
  };
  const result = await getPayPalAccessToken({ mode: 'sandbox', clientId: 'client-id', clientSecret: 'client-secret', fetchImpl: fakeFetch });
  assert.equal(result.ok, true);
  assert.equal(result.access_token, 'access-token');
  assert.equal(captured.url, 'https://api-m.sandbox.paypal.com/v1/oauth2/token');
  assert.match(captured.init.headers.Authorization, /^Basic\s+/);
  assert.equal(captured.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(captured.init.body, 'grant_type=client_credentials');
});

test('PayPal create order uses Sandbox CAPTURE intent, authoritative breakdown, and deterministic request ID', async () => {
  const { createPayPalOrder } = await paypal();
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({
      id: 'PAYPAL-ORDER-1',
      status: 'CREATED',
      purchase_units: [{ amount: { currency_code: 'USD', value: '30.00', breakdown: { item_total: { currency_code: 'USD', value: '25.00' }, shipping: { currency_code: 'USD', value: '5.00' } } } }],
    }), { status: 201 });
  };
  const result = await createPayPalOrder({
    total_cents: 3000,
    subtotal_cents: 2500,
    shipping_amount_cents: 500,
    order_id: 'order-1',
    order_number: 'MAY-1',
    idempotency_key: 'idem-paypal-00000001',
  }, { mode: 'sandbox', accessToken: 'access-token', fetchImpl: fakeFetch });
  assert.equal(result.ok, true);
  assert.equal(result.paypal_order.id, 'PAYPAL-ORDER-1');
  assert.equal(captured.url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders');
  assert.equal(captured.init.headers['PayPal-Request-Id'], 'mayionics:create:idem-paypal-00000001');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.intent, 'CAPTURE');
  assert.equal(body.purchase_units[0].reference_id, 'order-1');
  assert.equal(body.purchase_units[0].custom_id, 'MAY-1');
  assert.equal(body.purchase_units[0].amount.value, '30.00');
  assert.equal(body.purchase_units[0].amount.breakdown.item_total.value, '25.00');
  assert.equal(body.purchase_units[0].amount.breakdown.shipping.value, '5.00');
});

test('PayPal create order rejects amount mismatches returned by provider', async () => {
  const { createPayPalOrder } = await paypal();
  const fakeFetch = async () => new Response(JSON.stringify({
    id: 'PAYPAL-ORDER-1', status: 'CREATED', purchase_units: [{ amount: { currency_code: 'USD', value: '31.00' } }],
  }), { status: 201 });
  const result = await createPayPalOrder({ total_cents: 3000, subtotal_cents: 2500, shipping_amount_cents: 500, order_id: 'order-1', order_number: 'MAY-1', idempotency_key: 'idem-paypal-00000001' }, {
    mode: 'sandbox', accessToken: 'access-token', fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'paypal_amount_mismatch');
});

test('PayPal capture uses Sandbox endpoint and validates capture identity/status/currency/amount', async () => {
  const { capturePayPalOrder } = await paypal();
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({
      id: 'PAYPAL-ORDER-1',
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '30.00' } }] } }],
    }), { status: 201 });
  };
  const result = await capturePayPalOrder('PAYPAL-ORDER-1', 3000, 'access-token', {
    mode: 'sandbox', requestId: 'mayionics:capture:order-1', fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, true);
  assert.equal(result.capture.id, 'CAPTURE-1');
  assert.equal(captured.url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/PAYPAL-ORDER-1/capture');
  assert.equal(captured.init.headers['PayPal-Request-Id'], 'mayionics:capture:order-1');

  const badFetch = async () => new Response(JSON.stringify({
    id: 'PAYPAL-ORDER-1', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-2', status: 'COMPLETED', amount: { currency_code: 'USD', value: '29.00' } }] } }],
  }), { status: 201 });
  assert.equal((await capturePayPalOrder('PAYPAL-ORDER-1', 3000, 'access-token', { mode: 'sandbox', requestId: 'capture', fetchImpl: badFetch })).error, 'paypal_capture_amount_mismatch');
});

test('PayPal capture input requires local and provider identity', async () => {
  const { validatePayPalCaptureInput } = await paypal();
  assert.deepEqual(validatePayPalCaptureInput({ order_number: 'MAY-123', paypal_order_id: 'PAYPAL-ORDER-1' }), { ok: true, order_number: 'MAY-123', paypal_order_id: 'PAYPAL-ORDER-1' });
  assert.equal(validatePayPalCaptureInput({ order_number: '', paypal_order_id: 'x' }).ok, false);
  assert.equal(validatePayPalCaptureInput({ order_number: 'MAY-123', paypal_order_id: '' }).ok, false);
});

test('checkout attempt migration permits Stripe and PayPal without weakening unique replay/provider identity', () => {
  const sql = read('migrations/0003_checkout_attempts.sql');
  assert.match(sql, /provider\s+TEXT\s+NOT\s+NULL(?:\s+DEFAULT\s+'STRIPE')?\s+CHECK\s*\(\s*provider\s+IN\s*\(\s*'STRIPE'\s*,\s*'PAYPAL'\s*\)\s*\)/i);
  assert.match(sql, /idempotency_key\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
  assert.match(sql, /UNIQUE\s*\(\s*provider\s*,\s*provider_payment_id\s*\)/i);
});

test('Worker exposes PayPal create and capture routes and runtime contains no live PayPal API base', () => {
  const worker = read('src/worker.js');
  assert.match(worker, /\/api\/payments\/paypal\/create/);
  assert.match(worker, /\/api\/payments\/paypal\/capture/);
  assert.match(worker, /handlePayPalCheckout/);
  const runtime = read('src/paypal-checkout.js');
  assert.doesNotMatch(runtime, /https:\/\/api-m\.paypal\.com/);
  assert.doesNotMatch(runtime, /order_status\s*=\s*['"]PAID['"]/i);
  assert.doesNotMatch(runtime, /payment_status\s*=\s*['"]PAID['"]/i);
});
