import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pages = [
  'index.html',
  'shop.html',
  'categories.html',
  'product.html',
  'reviews.html',
  'about.html',
  'shipping-returns.html',
  'cart.html',
  'checkout.html',
  'order-confirmation.html',
];

const primaryLinks = [
  '/shop.html',
  '/categories.html',
  '/reviews.html',
  '/about.html',
  '/shipping-returns.html',
  '/cart.html',
];

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

test('P3 creates every approved customer-facing page', () => {
  for (const page of pages) {
    assert.ok(existsSync(join(root, page)), `${page} should exist`);
  }
});

test('all storefront pages use shared CSS and JavaScript assets', () => {
  for (const page of pages) {
    const html = read(page);
    assert.ok(html.includes('/assets/css/site.css'), `${page} should load shared CSS`);
    assert.ok(html.includes('/assets/js/site.js'), `${page} should load shared JavaScript`);
  }
});

test('homepage primary navigation points to real storefront pages', () => {
  const html = read('index.html');
  for (const href of primaryLinks) {
    assert.ok(html.includes(`href="${href}"`), `index.html should link to ${href}`);
  }
  assert.ok(html.includes('href="/shop.html"') && html.includes('Shop All'), 'hero Shop All action should route to Shop');
});

test('storefront shells clearly defer later commerce functionality', () => {
  assert.ok(read('shop.html').includes('Product listings will be connected in P4'));
  assert.ok(read('product.html').includes('Product details will be connected in P4'));
  assert.ok(read('cart.html').includes('Cart functionality will be connected in P6'));
  assert.ok(read('checkout.html').includes('Checkout will be activated in later test phases'));
  assert.ok(read('order-confirmation.html').includes('Order confirmation data will appear here after checkout integration'));
});

test('P3 frontend does not call commerce APIs or load payment provider SDKs', () => {
  const combined = pages.map(read).join('\n') + '\n' + read('assets/js/site.js');
  assert.doesNotMatch(combined, /\bfetch\s*\(/i);
  assert.doesNotMatch(combined, /stripe\.com|paypal\.com\/sdk|api\.easypost\.com/i);
});

test('seller review shell links to the public historical eBay feedback profile', () => {
  const html = read('reviews.html');
  assert.ok(html.includes('https://www.ebay.com/fdbk/feedback_profile/adama99'));
  assert.ok(html.includes('historical eBay seller feedback'));
});
