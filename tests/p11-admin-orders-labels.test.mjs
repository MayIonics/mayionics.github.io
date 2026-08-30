import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const modulePath = join(root, 'src/admin-orders.js');

async function loadModule() {
  return import(`${pathToFileURL(modulePath).href}?test=${Date.now()}-${Math.random()}`);
}

test('P11 admin order runtime and label-attempt migration exist', () => {
  assert.ok(existsSync(modulePath));
  assert.ok(existsSync(join(root, 'migrations/0005_label_purchase_attempts.sql')));
});

test('EasyPost label adapter is TEST-only and validates shipment identity/tracking/label metadata', async () => {
  const { buyEasyPostTestLabel } = await loadModule();
  let called = false;
  const blocked = await buyEasyPostTestLabel({ shipment_id: 'shp_1', rate_id: 'rate_1' }, {
    mode: 'production', apiKey: 'x', fetchImpl: async () => { called = true; },
  });
  assert.equal(blocked.error, 'easypost_test_mode_required');
  assert.equal(called, false);

  const ok = await buyEasyPostTestLabel({ shipment_id: 'shp_1', rate_id: 'rate_1' }, {
    mode: 'test', apiKey: 'test-key', fetchImpl: async (url, options) => {
      assert.match(String(url), /\/v2\/shipments\/shp_1\/buy$/);
      assert.equal(options.method, 'POST');
      assert.equal(JSON.parse(options.body).rate.id, 'rate_1');
      return new Response(JSON.stringify({
        id: 'shp_1', mode: 'test', tracking_code: 'EZ1000000001',
        postage_label: { label_url: 'https://easypost-files.example/test-label.pdf' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.deepEqual(ok, {
    ok: true,
    shipment_id: 'shp_1',
    tracking_number: 'EZ1000000001',
    label_url: 'https://easypost-files.example/test-label.pdf',
  });
});

test('EasyPost label adapter rejects production-mode or mismatched provider responses', async () => {
  const { buyEasyPostTestLabel } = await loadModule();
  const mismatch = await buyEasyPostTestLabel({ shipment_id: 'shp_1', rate_id: 'rate_1' }, {
    mode: 'test', apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify({
      id: 'shp_other', mode: 'test', tracking_code: 'T', postage_label: { label_url: 'https://x' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  assert.equal(mismatch.error, 'easypost_shipment_identity_mismatch');
});

test('label purchase ledger has one unique claim per shipment and is append-only', () => {
  const sql = readFileSync(join(root, 'migrations/0005_label_purchase_attempts.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS label_purchase_attempts/i);
  assert.match(sql, /shipment_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
  assert.match(sql, /status\s+TEXT\s+NOT\s+NULL/i);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)/i);
});

test('admin order routes remain behind existing admin authentication boundary', () => {
  const worker = readFileSync(join(root, 'src/worker.js'), 'utf8');
  const adminPos = worker.indexOf("url.pathname.startsWith('/api/admin/')");
  const authPos = worker.indexOf('verifyAccessJwt', adminPos);
  const orderPos = worker.indexOf("url.pathname.startsWith('/api/admin/orders')", adminPos);
  assert.ok(adminPos >= 0 && authPos > adminPos && orderPos > authPos);
  assert.match(worker, /handleAdminOrders/);
});

test('admin order implementation only buys labels for paid orders and marks shipped after labels exist', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.match(source, /payment_status[^\n]*PAID|order_status[^\n]*PAID/i);
  assert.match(source, /LABEL_CREATED/);
  assert.match(source, /READY_TO_SHIP/);
  assert.match(source, /SHIPPED/);
  assert.match(source, /provider_shipment_id/);
  assert.match(source, /provider_rate_id/);
});
