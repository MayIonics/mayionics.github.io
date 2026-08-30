import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pages = [
  'index.html', 'shop.html', 'categories.html', 'product.html', 'reviews.html',
  'about.html', 'shipping-returns.html', 'cart.html', 'checkout.html', 'order-confirmation.html',
];
const primaryLinks = ['/shop.html', '/categories.html', '/reviews.html', '/about.html', '/shipping-returns.html', '/cart.html'];

function read(file) { return readFileSync(join(root, file), 'utf8'); }

test('P3 customer-facing page set remains present', () => {
  for (const page of pages) assert.ok(existsSync(join(root, page)), `${page} should exist`);
});

test('all storefront pages retain shared CSS and baseline JavaScript', () => {
  for (const page of pages) {
    const html = read(page);
    assert.ok(html.includes('/assets/css/site.css'), `${page} should load shared CSS`);
    assert.ok(html.includes('/assets/js/site.js'), `${page} should load shared JavaScript`);
  }
});

test('homepage primary navigation retains real storefront routes', () => {
  const html = read('index.html');
  for (const href of primaryLinks) assert.ok(html.includes(`href="${href}"`), `index.html should link to ${href}`);
  assert.ok(html.includes('href="/shop.html"') && html.includes('Shop All'));
});

test('later-phase boundaries remain explicit where functionality is still inactive', () => {
  assert.ok(read('cart.html').includes('Cart functionality will be connected in P6'));
  assert.ok(read('checkout.html').includes('Checkout will be activated in later test phases'));
  assert.ok(read('order-confirmation.html').includes('Order confirmation data will appear here after checkout integration'));
});

test('storefront does not load payment or shipping provider SDKs', () => {
  const combined = pages.map(read).join('\n') + '\n' + read('assets/js/site.js');
  assert.doesNotMatch(combined, /stripe\.com|paypal\.com\/sdk|api\.easypost\.com/i);
});

test('seller review page retains the public historical eBay feedback source', () => {
  const html = read('reviews.html');
  assert.ok(html.includes('https://www.ebay.com/fdbk/feedback_profile/adama99'));
  assert.ok(html.includes('historical eBay seller feedback'));
});
