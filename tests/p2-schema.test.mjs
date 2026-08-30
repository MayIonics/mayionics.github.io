import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationPath = join(root, 'migrations/0001_initial_commerce.sql');

function sql() {
  assert.ok(existsSync(migrationPath), 'initial D1 migration should exist');
  return readFileSync(migrationPath, 'utf8');
}

function compact(value) {
  return value.replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim();
}

test('P2 creates the six approved commerce tables', () => {
  const source = compact(sql());
  for (const table of ['products', 'orders', 'order_items', 'payments', 'shipments', 'product_reservations']) {
    assert.match(source, new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, 'i'));
  }
});

test('products use integer cents and explicit inventory lifecycle constraints', () => {
  const source = compact(sql());
  assert.match(source, /price_cents INTEGER NOT NULL CHECK \(price_cents >= 0\)/i);
  assert.match(source, /quantity INTEGER NOT NULL DEFAULT 1 CHECK \(quantity >= 0\)/i);
  for (const status of ['ACTIVE', 'RESERVED', 'SOLD', 'HIDDEN']) assert.ok(source.includes(`'${status}'`));
  assert.match(source, /slug TEXT NOT NULL UNIQUE/i);
});

test('orders preserve authoritative totals and lifecycle states', () => {
  const source = compact(sql());
  for (const field of ['subtotal_cents', 'shipping_amount_cents', 'total_cents']) {
    assert.match(source, new RegExp(`${field} INTEGER NOT NULL CHECK \\(${field} >= 0\\)`, 'i'));
  }
  for (const status of ['PENDING', 'PAID', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']) {
    assert.ok(source.includes(`'${status}'`));
  }
  assert.match(source, /order_number TEXT NOT NULL UNIQUE/i);
});

test('order items snapshot purchased title and price and retain foreign keys', () => {
  const source = compact(sql());
  assert.match(source, /product_title TEXT NOT NULL/i);
  assert.match(source, /unit_price_cents INTEGER NOT NULL CHECK \(unit_price_cents >= 0\)/i);
  assert.match(source, /line_total_cents INTEGER NOT NULL CHECK \(line_total_cents >= 0\)/i);
  assert.match(source, /FOREIGN KEY \(order_id\) REFERENCES orders\(id\)/i);
  assert.match(source, /FOREIGN KEY \(product_id\) REFERENCES products\(id\)/i);
});

test('payments preserve provider identity for idempotent reconciliation', () => {
  const source = compact(sql());
  assert.match(source, /provider TEXT NOT NULL CHECK \(provider IN \('STRIPE', 'PAYPAL'\)\)/i);
  assert.match(source, /provider_payment_id TEXT NOT NULL/i);
  assert.match(source, /UNIQUE \(provider, provider_payment_id\)/i);
  assert.match(source, /amount_cents INTEGER NOT NULL CHECK \(amount_cents >= 0\)/i);
});

test('shipments retain EasyPost references and tracking metadata', () => {
  const source = compact(sql());
  for (const field of ['provider_shipment_id', 'provider_rate_id', 'tracking_number', 'label_url']) {
    assert.match(source, new RegExp(`${field} TEXT`, 'i'));
  }
  assert.match(source, /provider TEXT NOT NULL DEFAULT 'EASYPOST'/i);
});

test('reservations include quantity, expiry, lifecycle and lookup indexes', () => {
  const source = compact(sql());
  assert.match(source, /expires_at TEXT NOT NULL/i);
  assert.match(source, /reserved_quantity INTEGER NOT NULL DEFAULT 1 CHECK \(reserved_quantity > 0\)/i);
  for (const status of ['ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED']) assert.ok(source.includes(`'${status}'`));
  assert.match(source, /CREATE INDEX(?: IF NOT EXISTS)? idx_product_reservations_product_status/i);
  assert.match(source, /CREATE INDEX(?: IF NOT EXISTS)? idx_product_reservations_expiry/i);
});

test('initial migration is append-only and contains no destructive drops', () => {
  const source = sql();
  assert.doesNotMatch(source, /\bDROP\s+(?:TABLE|INDEX|COLUMN)\b/i);
});
