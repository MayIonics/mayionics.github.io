import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

async function cartCore() {
  return import('../assets/js/cart-core.js');
}

async function reservations() {
  return import('../src/reservations.js');
}

test('P6 cart core exposes quantity-only cart operations', async () => {
  assert.ok(existsSync(join(root, 'assets/js/cart-core.js')));
  const mod = await cartCore();
  for (const name of ['normalizeCart', 'addCartItem', 'setCartItemQuantity', 'removeCartItem', 'cartCount']) {
    assert.equal(typeof mod[name], 'function', `${name} should be exported`);
  }
});

test('cart normalization keeps only product identity and positive integer quantity', async () => {
  const { normalizeCart } = await cartCore();
  const normalized = normalizeCart([
    { product_id: 'prod-a', quantity: 1, price_cents: 1, title: 'tampered' },
    { product_id: 'prod-a', quantity: 2 },
    { product_id: 'prod-b', quantity: 0 },
    { product_id: '', quantity: 1 },
    { product_id: 'prod-c', quantity: 1.5 },
  ]);
  assert.deepEqual(normalized, [{ product_id: 'prod-a', quantity: 3 }]);
  assert.deepEqual(Object.keys(normalized[0]).sort(), ['product_id', 'quantity']);
});

test('cart add update remove and count behavior is deterministic', async () => {
  const { addCartItem, setCartItemQuantity, removeCartItem, cartCount } = await cartCore();
  let cart = addCartItem([], 'prod-a', 1);
  cart = addCartItem(cart, 'prod-a', 2);
  cart = addCartItem(cart, 'prod-b', 1);
  assert.deepEqual(cart, [
    { product_id: 'prod-a', quantity: 3 },
    { product_id: 'prod-b', quantity: 1 },
  ]);
  assert.equal(cartCount(cart), 4);
  cart = setCartItemQuantity(cart, 'prod-a', 1);
  assert.equal(cartCount(cart), 2);
  cart = setCartItemQuantity(cart, 'prod-b', 0);
  assert.deepEqual(cart, [{ product_id: 'prod-a', quantity: 1 }]);
  assert.deepEqual(removeCartItem(cart, 'prod-a'), []);
});

test('reservation input accepts only product id plus bounded positive integer quantity', async () => {
  const { validateReservationInput } = await reservations();
  assert.deepEqual(validateReservationInput({ product_id: 'prod-a', quantity: 2 }), {
    ok: true,
    product_id: 'prod-a',
    quantity: 2,
  });
  for (const input of [
    {},
    { product_id: '', quantity: 1 },
    { product_id: 'prod-a', quantity: 0 },
    { product_id: 'prod-a', quantity: 1.5 },
    { product_id: 'prod-a', quantity: 101 },
  ]) {
    assert.equal(validateReservationInput(input).ok, false);
  }
});

test('P6 reservation migration adds insert and update capacity guards without destructive schema changes', () => {
  const path = join(root, 'migrations/0002_reservation_capacity_guards.sql');
  assert.ok(existsSync(path));
  const sql = read('migrations/0002_reservation_capacity_guards.sql');
  assert.match(sql, /CREATE\s+TRIGGER\s+reservation_capacity_before_insert/i);
  assert.match(sql, /CREATE\s+TRIGGER\s+reservation_capacity_before_update/i);
  assert.match(sql, /RAISE\s*\(\s*ABORT\s*,\s*'reservation_capacity_exceeded'\s*\)/i);
  assert.match(sql, /status\s*=\s*'ACTIVE'/i);
  assert.match(sql, /expires_at\s*>/i);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
});

test('Worker exposes public reservation create and release routes before admin authentication', () => {
  const worker = read('src/worker.js');
  assert.match(worker, /\/api\/reservations/);
  assert.match(worker, /handleReservations/);
  const reservationIndex = worker.indexOf('/api/reservations');
  const adminIndex = worker.indexOf("url.pathname.startsWith('/api/admin/')");
  assert.ok(reservationIndex >= 0 && adminIndex >= 0 && reservationIndex < adminIndex);
});

test('cart page and product rendering expose P6 mount points without activating checkout', () => {
  const cart = read('cart.html');
  const catalog = read('assets/js/catalog.js');
  assert.match(cart, /data-cart-items/);
  assert.match(cart, /data-cart-empty/);
  assert.match(cart, /data-cart-checkout/);
  assert.match(catalog, /data-add-to-cart/);
  assert.match(catalog, /Add to Cart/);
  assert.match(cart, /Checkout remains inactive until later phases/);
});
