import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, '.github/workflows/p13-test-bootstrap.yml');

test('P13 TEST bootstrap workflow exists', () => {
  assert.ok(existsSync(path));
});

test('bootstrap is manual-only and names only dedicated TEST resources', () => {
  const yaml = readFileSync(path, 'utf8');
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(yaml, /^\s*push:/m);
  assert.doesNotMatch(yaml, /^\s*pull_request:/m);
  assert.match(yaml, /mayionics-api-test/);
  assert.match(yaml, /mayionics-test/);
  assert.match(yaml, /MAYIONICS_DB/);
});

test('bootstrap requires encrypted Cloudflare credentials and never embeds token values', () => {
  const yaml = readFileSync(path, 'utf8');
  assert.match(yaml, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(yaml, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(yaml, /Bearer\s+[A-Za-z0-9_-]{20,}/);
});

test('generated runtime is explicitly TEST/Sandbox only', () => {
  const yaml = readFileSync(path, 'utf8');
  assert.match(yaml, /EASYPOST_MODE/);
  assert.match(yaml, /STRIPE_MODE/);
  assert.match(yaml, /PAYPAL_MODE/);
  assert.match(yaml, /"test"/);
  assert.match(yaml, /"sandbox"/);
  assert.doesNotMatch(yaml, /STRIPE_MODE[^\n]*live/i);
  assert.doesNotMatch(yaml, /PAYPAL_MODE[^\n]*live/i);
});

test('bootstrap applies migrations remotely before deploying and verifies health/schema', () => {
  const yaml = readFileSync(path, 'utf8');
  const migration = yaml.indexOf('d1 execute');
  const deploy = yaml.indexOf('wrangler@4.102.0 deploy');
  assert.ok(migration >= 0 && deploy > migration);
  assert.match(yaml, /--remote/);
  assert.match(yaml, /--yes/);
  assert.match(yaml, /\/health/);
  assert.match(yaml, /webhook_events/);
  assert.match(yaml, /label_purchase_attempts/);
});

test('bootstrap is retry-safe after current P13 schema has already been applied', () => {
  const yaml = readFileSync(path, 'utf8');
  assert.match(yaml, /current_schema_complete/);
  assert.match(yaml, /label_purchase_attempts/);
  assert.match(yaml, /Skipping current P13 migrations/);
});

test('deploy step disables inherited errexit before capturing Wrangler failure output', () => {
  const yaml = readFileSync(path, 'utf8');
  const deployStep = yaml.slice(yaml.indexOf('- name: Deploy dedicated TEST Worker'));
  assert.match(deployStep, /set \+e/);
  assert.match(deployStep, /STATUS=\$\?/);
  assert.match(deployStep, /Wrangler deploy failed with exit code/);
});

test('temporary Wrangler config resolves the Worker entrypoint from the repository workspace', () => {
  const yaml = readFileSync(path, 'utf8');
  assert.match(yaml, /GITHUB_WORKSPACE/);
  assert.match(yaml, /src\/worker\.js/);
});

test('health verification captures Cloudflare response headers and a bounded Worker tail on failure', () => {
  const yaml = readFileSync(path, 'utf8');
  const healthStep = yaml.slice(yaml.indexOf('- name: Verify TEST Worker health'), yaml.indexOf('- name: Verify TEST D1 schema'));
  assert.match(healthStep, /wrangler@4\.102\.0 tail/);
  assert.match(healthStep, /timeout\s+20s/);
  assert.match(healthStep, /--format=json/);
  assert.match(healthStep, /health\.headers/);
  assert.match(healthStep, /cf-ray/i);
  assert.match(healthStep, /Worker tail diagnostics/);
});

test('bootstrap does not configure or invoke commerce provider secrets', () => {
  const yaml = readFileSync(path, 'utf8');
  for (const name of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'EASYPOST_API_KEY']) {
    assert.doesNotMatch(yaml, new RegExp(name));
  }
  assert.doesNotMatch(yaml, /api\.stripe\.com/i);
  assert.doesNotMatch(yaml, /api-m\.sandbox\.paypal\.com/i);
  assert.doesNotMatch(yaml, /api\.easypost\.com/i);
});
