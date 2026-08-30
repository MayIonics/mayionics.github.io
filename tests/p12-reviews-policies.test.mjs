import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

test('P12 privacy and terms pages exist', () => {
  assert.ok(existsSync(join(root, 'privacy.html')));
  assert.ok(existsSync(join(root, 'terms.html')));
});

test('Seller Reviews clearly identifies historical eBay feedback and verification source', () => {
  const html = read('reviews.html');
  assert.match(html, /historical eBay seller feedback/i);
  assert.match(html, /ebay\.com\/fdbk\/feedback_profile\/adama99/i);
  assert.match(html, /not reviews of purchases made on MayIonics/i);
  const cards = (html.match(/class="review-card"/g) || []).length;
  assert.ok(cards >= 6, `expected at least 6 historical review cards, found ${cards}`);
});

test('P12 does not import NutriLeaf or Etsy product reviews into MayIonics reviews', () => {
  const html = read('reviews.html');
  assert.doesNotMatch(html, /Nutrileaf/i);
  assert.doesNotMatch(html, /Etsy/i);
});

test('About explains independent resale sourcing and condition transparency', () => {
  const html = read('about.html');
  assert.match(html, /independent/i);
  assert.match(html, /discount|garage sale|resale|source/i);
  assert.match(html, /condition/i);
});

test('Shipping and Returns is explicitly pre-launch and covers tracked shipping and returns', () => {
  const html = read('shipping-returns.html');
  assert.match(html, /pre-launch|development policy|final launch review/i);
  assert.match(html, /tracking|tracked/i);
  assert.match(html, /return/i);
  assert.match(html, /United States|U\.S\./i);
});

test('Privacy explains cart local storage and provider-handled payment credentials', () => {
  const html = read('privacy.html');
  assert.match(html, /localStorage|local storage/i);
  assert.match(html, /Stripe/i);
  assert.match(html, /PayPal/i);
  assert.match(html, /do not store|does not store/i);
});

test('Terms covers condition, availability, payment, shipping, and returns and remains pre-launch', () => {
  const html = read('terms.html');
  for (const marker of ['condition', 'availability', 'payment', 'shipping', 'return']) assert.match(html, new RegExp(marker, 'i'));
  assert.match(html, /pre-launch|development|before launch/i);
});

test('homepage footer links Privacy and Terms routes', () => {
  const html = read('index.html');
  assert.match(html, /href="privacy\.html"/i);
  assert.match(html, /href="terms\.html"/i);
});
