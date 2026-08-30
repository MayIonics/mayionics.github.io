import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const fixtures = [
  { id: 'p1', slug: 'camera', title: 'Camera', description: 'A camera', price_cents: 4999, quantity: 1, condition: 'PRE_OWNED', category: 'Electronics', images: ['/camera.jpg'], status: 'ACTIVE', featured: true, created_at: '2026-08-30T10:00:00Z' },
  { id: 'p2', slug: 'lamp', title: 'Lamp', description: 'A lamp', price_cents: 2500, quantity: 2, condition: 'OPEN_BOX', category: 'Home', images: [], status: 'ACTIVE', featured: false, created_at: '2026-08-29T10:00:00Z' },
  { id: 'p3', slug: 'sold-tool', title: 'Sold Tool', description: 'Sold', price_cents: 1500, quantity: 0, condition: 'PRE_OWNED', category: 'Tools', images: [], status: 'SOLD', featured: false, created_at: '2026-08-28T10:00:00Z' },
];

test('P4 catalog module exists and exposes the approved pure API', async () => {
  assert.ok(existsSync(join(root, 'assets/js/catalog-core.js')));
  const core = await import(`../assets/js/catalog-core.js?test=${Date.now()}`);
  for (const name of ['validateProduct', 'formatPrice', 'formatCondition', 'isPurchasable', 'publicProducts', 'filterProducts', 'sortProducts', 'findProductBySlug']) {
    assert.equal(typeof core[name], 'function', `${name} should be exported`);
  }
});

test('product validation accepts the D1-aligned public shape and rejects invalid money/inventory', async () => {
  const { validateProduct } = await import('../assets/js/catalog-core.js');
  assert.equal(validateProduct(fixtures[0]).valid, true);
  assert.equal(validateProduct({ ...fixtures[0], price_cents: 49.99 }).valid, false);
  assert.equal(validateProduct({ ...fixtures[0], quantity: -1 }).valid, false);
  assert.equal(validateProduct({ ...fixtures[0], slug: '' }).valid, false);
});

test('catalog formatting is stable', async () => {
  const { formatPrice, formatCondition } = await import('../assets/js/catalog-core.js');
  assert.equal(formatPrice(4999), '$49.99');
  assert.equal(formatPrice(0), '$0.00');
  assert.equal(formatCondition('OPEN_BOX'), 'Open Box');
  assert.equal(formatCondition('PRE_OWNED'), 'Pre-Owned');
});

test('public catalog excludes hidden/sold/unavailable inventory', async () => {
  const { publicProducts, isPurchasable } = await import('../assets/js/catalog-core.js');
  assert.equal(isPurchasable(fixtures[0]), true);
  assert.equal(isPurchasable(fixtures[2]), false);
  assert.deepEqual(publicProducts([...fixtures, { ...fixtures[0], id: 'p4', slug: 'hidden', status: 'HIDDEN' }]).map(p => p.slug), ['camera', 'lamp']);
});

test('catalog filters and sorting work on public product records', async () => {
  const { filterProducts, sortProducts } = await import('../assets/js/catalog-core.js');
  assert.deepEqual(filterProducts(fixtures, { category: 'Electronics' }).map(p => p.slug), ['camera']);
  assert.deepEqual(filterProducts(fixtures, { condition: 'OPEN_BOX' }).map(p => p.slug), ['lamp']);
  assert.deepEqual(filterProducts(fixtures, { maxPriceCents: 3000 }).map(p => p.slug), ['lamp']);
  assert.deepEqual(sortProducts(fixtures.slice(0, 2), 'price-asc').map(p => p.slug), ['lamp', 'camera']);
  assert.deepEqual(sortProducts(fixtures.slice(0, 2), 'newest').map(p => p.slug), ['camera', 'lamp']);
});

test('slug lookup can show sold items while excluding hidden items', async () => {
  const { findProductBySlug } = await import('../assets/js/catalog-core.js');
  assert.equal(findProductBySlug(fixtures, 'sold-tool')?.status, 'SOLD');
  assert.equal(findProductBySlug([{ ...fixtures[0], status: 'HIDDEN' }], 'camera'), null);
});

test('public product source starts empty rather than publishing fake inventory', async () => {
  const source = readFileSync(join(root, 'assets/js/products.js'), 'utf8');
  assert.match(source, /export const PRODUCTS\s*=\s*\[\s*\]/);
});

test('shop, product, and home pages contain P4 catalog mount points', () => {
  const shop = readFileSync(join(root, 'shop.html'), 'utf8');
  const product = readFileSync(join(root, 'product.html'), 'utf8');
  const home = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(shop.includes('data-catalog-grid'));
  assert.ok(shop.includes('data-catalog-empty'));
  assert.ok(product.includes('data-product-detail'));
  assert.ok(home.includes('data-new-arrivals'));
  assert.ok(home.includes('data-featured-products'));
  for (const html of [shop, product, home]) assert.ok(html.includes('/assets/js/catalog.js'));
});
