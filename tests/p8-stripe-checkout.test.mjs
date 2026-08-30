import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

async function stripe() {
  return import('../src/stripe-checkout.js');
}

test('P8 Stripe checkout module exposes validation, authority, and adapter helpers', async () => {
  assert.ok(existsSync(join(root, 'src/stripe-checkout.js')));
  const mod = await stripe();
  for (const name of ['validateStripeCheckoutInput', 'calculateAuthoritativeSubtotal', 'createStripePaymentIntent']) {
    assert.equal(typeof mod[name], 'function', `${name} should be exported`);
  }
});

test('checkout input rejects browser totals and accepts only identity/selection/customer fields', async () => {
  const { validateStripeCheckoutInput } = await stripe();
  const validInput = {
    idempotency_key: '56c24db5-1202-43d5-9c6e-63a809944b63',
    reservation_tokens: ['reserve-a', 'reserve-b'],
    shipping: { carrier: 'USPS', service: 'GroundAdvantage' },
    customer: {
      name: 'Buyer Name',
      email: 'buyer@example.com',
      address: { street1: '1 Main St', city: 'San Diego', state: 'CA', zip: '92101', country: 'US' },
    },
  };
  const valid = validateStripeCheckoutInput(validInput);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.reservation_tokens, ['reserve-a', 'reserve-b']);

  for (const extra of ['subtotal_cents', 'shipping_amount_cents', 'total_cents', 'amount']) {
    assert.equal(validateStripeCheckoutInput({ ...validInput, [extra]: 1 }).ok, false, `${extra} should be rejected`);
  }
  assert.equal(validateStripeCheckoutInput({ ...validInput, idempotency_key: 'short' }).ok, false);
  assert.equal(validateStripeCheckoutInput({ ...validInput, reservation_tokens: [] }).ok, false);
  assert.equal(validateStripeCheckoutInput({ ...validInput, reservation_tokens: ['same', 'same'] }).ok, false);
  assert.equal(validateStripeCheckoutInput({ ...validInput, shipping: { carrier: '', service: 'Ground' } }).ok, false);
  assert.equal(validateStripeCheckoutInput({ ...validInput, customer: { ...validInput.customer, email: 'not-email' } }).ok, false);
});

test('authoritative subtotal uses reservation quantities and D1 product prices', async () => {
  const { calculateAuthoritativeSubtotal } = await stripe();
  const rows = [
    { reservation_token: 'r1', reserved_quantity: 2, reservation_status: 'ACTIVE', expires_at: '2099-01-01T00:00:00.000Z', product_id: 'p1', product_title: 'One', price_cents: 1250, product_status: 'ACTIVE' },
    { reservation_token: 'r2', reserved_quantity: 1, reservation_status: 'ACTIVE', expires_at: '2099-01-01T00:00:00.000Z', product_id: 'p2', product_title: 'Two', price_cents: 500, product_status: 'ACTIVE' },
  ];
  const result = calculateAuthoritativeSubtotal(['r1', 'r2'], rows, new Date('2026-08-30T20:00:00.000Z'));
  assert.equal(result.ok, true);
  assert.equal(result.subtotal_cents, 3000);
  assert.deepEqual(result.items.map(item => ({ product_id: item.product_id, quantity: item.quantity, unit_price_cents: item.unit_price_cents })), [
    { product_id: 'p1', quantity: 2, unit_price_cents: 1250 },
    { product_id: 'p2', quantity: 1, unit_price_cents: 500 },
  ]);

  assert.equal(calculateAuthoritativeSubtotal(['missing'], rows, new Date()).ok, false);
  assert.equal(calculateAuthoritativeSubtotal(['r1'], [{ ...rows[0], reservation_status: 'EXPIRED' }], new Date()).ok, false);
  assert.equal(calculateAuthoritativeSubtotal(['r1'], [{ ...rows[0], product_status: 'SOLD' }], new Date()).ok, false);
});

test('Stripe adapter refuses non-test configuration before network access', async () => {
  const { createStripePaymentIntent } = await stripe();
  let calls = 0;
  const fakeFetch = async () => { calls += 1; return new Response('{}'); };
  const result = await createStripePaymentIntent({ amount_cents: 2500, order_id: 'order-1', order_number: 'MAY-1', receipt_email: 'buyer@example.com', idempotency_key: 'idem-1' }, {
    mode: 'live', secretKey: 'sk_live_fake', fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'stripe_test_mode_required');
  assert.equal(calls, 0);
});

test('Stripe adapter validates non-live response amount and currency', async () => {
  const { createStripePaymentIntent } = await stripe();
  const base = { amount_cents: 2500, order_id: 'order-1', order_number: 'MAY-1', receipt_email: 'buyer@example.com', idempotency_key: 'idem-1' };

  const liveFetch = async () => new Response(JSON.stringify({ id: 'pi_live', livemode: true, amount: 2500, currency: 'usd', client_secret: 'secret' }), { status: 200 });
  assert.equal((await createStripePaymentIntent(base, { mode: 'test', secretKey: 'sk_test_fake', fetchImpl: liveFetch })).error, 'stripe_mode_mismatch');

  const amountFetch = async () => new Response(JSON.stringify({ id: 'pi_test', livemode: false, amount: 2600, currency: 'usd', client_secret: 'secret' }), { status: 200 });
  assert.equal((await createStripePaymentIntent(base, { mode: 'test', secretKey: 'sk_test_fake', fetchImpl: amountFetch })).error, 'stripe_amount_mismatch');
});

test('Stripe request uses authoritative cents, metadata, and deterministic idempotency header', async () => {
  const { createStripePaymentIntent } = await stripe();
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ id: 'pi_test_123', livemode: false, amount: 2500, currency: 'usd', client_secret: 'pi_test_secret', status: 'requires_payment_method' }), { status: 200 });
  };
  const result = await createStripePaymentIntent({ amount_cents: 2500, order_id: 'order-1', order_number: 'MAY-1', receipt_email: 'buyer@example.com', idempotency_key: 'idem-abc' }, {
    mode: 'test', secretKey: 'sk_test_fake', fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, true);
  assert.equal(captured.url, 'https://api.stripe.com/v1/payment_intents');
  assert.equal(captured.init.headers['Idempotency-Key'], 'mayionics:idem-abc');
  const params = new URLSearchParams(captured.init.body);
  assert.equal(params.get('amount'), '2500');
  assert.equal(params.get('currency'), 'usd');
  assert.equal(params.get('automatic_payment_methods[enabled]'), 'true');
  assert.equal(params.get('metadata[order_id]'), 'order-1');
  assert.equal(params.get('metadata[order_number]'), 'MAY-1');
});

test('checkout attempt migration provides unique replay and provider identity constraints', () => {
  const path = join(root, 'migrations/0003_checkout_attempts.sql');
  assert.ok(existsSync(path));
  const sql = read('migrations/0003_checkout_attempts.sql');
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+checkout_attempts/i);
  assert.match(sql, /idempotency_key\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
  assert.match(sql, /order_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
  assert.match(sql, /UNIQUE\s*\(\s*provider\s*,\s*provider_payment_id\s*\)/i);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
});

test('Worker exposes Stripe create route while checkout code does not mark orders paid', () => {
  const worker = read('src/worker.js');
  assert.match(worker, /\/api\/payments\/stripe\/create/);
  assert.match(worker, /handleStripeCheckout/);
  const checkout = read('src/stripe-checkout.js');
  assert.doesNotMatch(checkout, /order_status\s*=\s*['"]PAID['"]/i);
  assert.doesNotMatch(checkout, /payment_status\s*=\s*['"]PAID['"]/i);
});
