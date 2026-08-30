import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';

const root = process.cwd();
const enc = new TextEncoder();

function b64url(input) {
  const bytes = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);
  return bytes.toString('base64url');
}

async function signedAccessToken(claimOverrides = {}) {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: 'test-key', typ: 'JWT' };
  const claims = {
    iss: 'https://example.cloudflareaccess.com',
    aud: ['test-audience'],
    email: 'admin@example.com',
    exp: now + 300,
    nbf: now - 5,
    ...claimOverrides,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(signingInput));
  return { token: `${signingInput}.${b64url(signature)}`, publicJwk, claims };
}

test('P5 runtime and admin client files exist', () => {
  for (const file of ['src/access-auth.js', 'src/admin-products.js', 'src/worker.js', 'admin/index.html', 'admin/admin.js']) {
    assert.ok(existsSync(join(root, file)), `${file} should exist`);
  }
});

test('Access claim policy requires issuer, audience, time validity, and allowlisted email', async () => {
  const { authorizeAccessClaims } = await import('../src/access-auth.js');
  const env = { CF_ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', CF_ACCESS_AUD: 'test-audience', ADMIN_EMAILS: 'admin@example.com,second@example.com' };
  const now = 2_000_000_000;
  const valid = { iss: 'https://example.cloudflareaccess.com', aud: ['test-audience'], email: 'admin@example.com', exp: now + 100, nbf: now - 100 };
  assert.equal(authorizeAccessClaims(valid, env, now).ok, true);
  assert.equal(authorizeAccessClaims({ ...valid, iss: 'https://wrong.cloudflareaccess.com' }, env, now).ok, false);
  assert.equal(authorizeAccessClaims({ ...valid, aud: ['wrong'] }, env, now).ok, false);
  assert.equal(authorizeAccessClaims({ ...valid, exp: now - 1 }, env, now).ok, false);
  assert.equal(authorizeAccessClaims({ ...valid, nbf: now + 1 }, env, now).ok, false);
  assert.equal(authorizeAccessClaims({ ...valid, email: 'other@example.com' }, env, now).status, 403);
});

test('Access JWT verification validates an RS256 signature against configured Cloudflare JWKs', async () => {
  const { verifyAccessJwt } = await import('../src/access-auth.js');
  const { token, publicJwk } = await signedAccessToken();
  const request = new Request('https://admin.example.com/api/admin/products', { headers: { 'Cf-Access-Jwt-Assertion': token } });
  const env = { CF_ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', CF_ACCESS_AUD: 'test-audience', ADMIN_EMAILS: 'admin@example.com' };
  const fetchFn = async url => {
    assert.equal(String(url), 'https://example.cloudflareaccess.com/cdn-cgi/access/certs');
    return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await verifyAccessJwt(request, env, { fetchFn, subtle: webcrypto.subtle });
  assert.equal(result.ok, true);
  assert.equal(result.email, 'admin@example.com');
});

test('Access JWT verification rejects missing or tampered assertions', async () => {
  const { verifyAccessJwt } = await import('../src/access-auth.js');
  const env = { CF_ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', CF_ACCESS_AUD: 'test-audience', ADMIN_EMAILS: 'admin@example.com' };
  assert.equal((await verifyAccessJwt(new Request('https://example.com'), env)).status, 401);
  const { token, publicJwk } = await signedAccessToken();
  const parts = token.split('.');
  parts[1] = b64url(JSON.stringify({ iss: 'https://example.cloudflareaccess.com', aud: ['test-audience'], email: 'admin@example.com', exp: Math.floor(Date.now()/1000)+300 }));
  const request = new Request('https://example.com', { headers: { 'Cf-Access-Jwt-Assertion': parts.join('.') } });
  const fetchFn = async () => new Response(JSON.stringify({ keys: [publicJwk] }));
  assert.equal((await verifyAccessJwt(request, env, { fetchFn, subtle: webcrypto.subtle })).status, 401);
});

test('admin product validation enforces integer cents and physical/inventory constraints', async () => {
  const { validateAdminProductInput } = await import('../src/admin-products.js');
  const valid = { slug: 'camera', title: 'Camera', description: 'Used camera', price_cents: 4999, quantity: 1, condition: 'PRE_OWNED', category: 'Electronics', images: [], weight_oz: 16, length_in: 8, width_in: 6, height_in: 4, featured: false, status: 'ACTIVE' };
  assert.equal(validateAdminProductInput(valid).valid, true);
  assert.equal(validateAdminProductInput({ ...valid, price_cents: 49.99 }).valid, false);
  assert.equal(validateAdminProductInput({ ...valid, quantity: -1 }).valid, false);
  assert.equal(validateAdminProductInput({ ...valid, weight_oz: 0 }).valid, false);
  assert.equal(validateAdminProductInput({ ...valid, condition: 'USEDISH' }).valid, false);
});

test('admin product implementation uses hide semantics and no permanent product DELETE', () => {
  const source = readFileSync(join(root, 'src/admin-products.js'), 'utf8');
  assert.doesNotMatch(source, /DELETE\s+FROM\s+products/i);
  assert.match(source, /UPDATE\s+products\s+SET\s+status\s*=\s*'HIDDEN'/i);
});

test('Worker protects admin routing before product handlers', () => {
  const source = readFileSync(join(root, 'src/worker.js'), 'utf8');
  const authIndex = source.indexOf('verifyAccessJwt');
  const handlerIndex = source.indexOf('handleAdminProducts');
  assert.ok(authIndex >= 0 && handlerIndex > authIndex, 'auth verification should precede admin product handling');
});

test('admin client is unlinked, noindexed, and locked on github.io', () => {
  const html = readFileSync(join(root, 'admin/index.html'), 'utf8');
  const js = readFileSync(join(root, 'admin/admin.js'), 'utf8');
  const homepage = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/i);
  assert.ok(js.includes('github.io'));
  assert.doesNotMatch(homepage, /href="\/admin\//i);
});
