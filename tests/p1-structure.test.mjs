import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'assets/css/site.css',
  'assets/js/site.js',
  'README.md',
  'docs/PROJECT_STATE.md',
];

function textFiles(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...textFiles(full));
    else if (/\.(?:html|css|js|mjs|json|md|txt|yml|yaml)$/i.test(name)) results.push(full);
  }
  return results;
}

test('P1 required files exist', () => {
  for (const file of requiredFiles) {
    assert.ok(existsSync(join(root, file)), `${file} should exist`);
  }
});

test('homepage contains the approved P1 content markers', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  for (const marker of [
    'MayIonics',
    'Shop',
    'New Arrivals',
    'Shop by Category',
    'Seller Reviews',
    'Secure Payments',
    'Tracked Shipping',
  ]) {
    assert.ok(html.includes(marker), `index.html should contain ${marker}`);
  }
});

test('repository contains no obvious provider secret assignments', () => {
  const pattern = /\b(?:STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET|EASYPOST_API_KEY)\s*=\s*[^\s#]+/;
  for (const file of textFiles(root)) {
    const content = readFileSync(file, 'utf8');
    assert.equal(pattern.test(content), false, `${relative(root, file)} contains an apparent provider secret assignment`);
  }
});

test('project documentation preserves the P1 baseline history', () => {
  const state = readFileSync(join(root, 'docs/PROJECT_STATE.md'), 'utf8');
  assert.ok(state.includes('P1'), 'PROJECT_STATE.md should retain P1 history');
  assert.ok(
    existsSync(join(root, 'docs/superpowers/plans/2026-08-30-p1-github-pages-baseline.md')),
    'P1 implementation plan should remain in the repository',
  );
});

test('README identifies the MayIonics development site', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.ok(readme.includes('https://mayionics.github.io/'), 'README should contain the development URL');
  assert.ok(readme.includes('MayIonics'), 'README should identify the project');
});
