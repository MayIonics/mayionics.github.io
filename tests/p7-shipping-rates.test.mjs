import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

async function shipping() {
  return import('../src/shipping-rates.js');
}

test('P7 shipping module exposes validation, parcel, rate, and adapter helpers', async () => {
  assert.ok(existsSync(join(root, 'src/shipping-rates.js')));
  const mod = await shipping();
  for (const name of ['validateShippingRateInput', 'buildParcelUnits', 'rateStringToCents', 'combineParcelRates', 'createEasyPostShipment']) {
    assert.equal(typeof mod[name], 'function', `${name} should be exported`);
  }
});

test('shipping request accepts US destination plus quantity-only items and rejects unsafe shapes', async () => {
  const { validateShippingRateInput } = await shipping();
  const valid = validateShippingRateInput({
    items: [{ product_id: 'prod-a', quantity: 2 }],
    to_address: { name: 'Buyer', street1: '1 Main St', city: 'San Diego', state: 'CA', zip: '92101', country: 'US' },
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.items, [{ product_id: 'prod-a', quantity: 2 }]);
  assert.equal(valid.to_address.country, 'US');

  for (const input of [
    {},
    { items: [], to_address: {} },
    { items: [{ product_id: 'prod-a', quantity: 0 }], to_address: valid.to_address },
    { items: [{ product_id: 'prod-a', quantity: 11 }], to_address: valid.to_address },
    { items: [{ product_id: 'prod-a', quantity: 1, price_cents: 1 }], to_address: valid.to_address },
    { items: [{ product_id: 'prod-a', quantity: 1 }], to_address: { ...valid.to_address, country: 'CA' } },
  ]) {
    assert.equal(validateShippingRateInput(input).ok, false);
  }
});

test('parcel units come only from authoritative product measurements', async () => {
  const { buildParcelUnits } = await shipping();
  const products = [{ id: 'prod-a', status: 'ACTIVE', quantity: 2, weight_oz: 12.5, length_in: 8, width_in: 6, height_in: 3 }];
  const result = buildParcelUnits([{ product_id: 'prod-a', quantity: 2 }], products);
  assert.equal(result.ok, true);
  assert.deepEqual(result.parcels, [
    { product_id: 'prod-a', length: 8, width: 6, height: 3, weight: 12.5 },
    { product_id: 'prod-a', length: 8, width: 6, height: 3, weight: 12.5 },
  ]);
  assert.equal(buildParcelUnits([{ product_id: 'prod-a', quantity: 3 }], products).ok, false);
  assert.equal(buildParcelUnits([{ product_id: 'missing', quantity: 1 }], products).ok, false);
  assert.equal(buildParcelUnits([{ product_id: 'prod-a', quantity: 1 }], [{ ...products[0], weight_oz: null }]).ok, false);
});

test('EasyPost decimal rates convert exactly to integer cents', async () => {
  const { rateStringToCents } = await shipping();
  assert.equal(rateStringToCents('11.01'), 1101);
  assert.equal(rateStringToCents('0.99'), 99);
  assert.equal(rateStringToCents('12'), 1200);
  assert.equal(rateStringToCents('12.345'), null);
  assert.equal(rateStringToCents('nope'), null);
});

test('combined quotes require the same carrier service and currency for every parcel', async () => {
  const { combineParcelRates } = await shipping();
  const combined = combineParcelRates([
    { shipment_id: 'shp_1', rates: [
      { id: 'rate_1a', carrier: 'USPS', service: 'GroundAdvantage', rate: '5.00', currency: 'USD', delivery_days: 4 },
      { id: 'rate_1b', carrier: 'USPS', service: 'Priority', rate: '8.00', currency: 'USD', delivery_days: 2 },
    ] },
    { shipment_id: 'shp_2', rates: [
      { id: 'rate_2a', carrier: 'USPS', service: 'GroundAdvantage', rate: '6.25', currency: 'USD', delivery_days: 5 },
      { id: 'rate_2c', carrier: 'UPS', service: 'Ground', rate: '9.00', currency: 'USD', delivery_days: 3 },
    ] },
  ]);
  assert.deepEqual(combined, [{
    carrier: 'USPS', service: 'GroundAdvantage', currency: 'USD', amount_cents: 1125, delivery_days: 5,
    components: [
      { shipment_id: 'shp_1', rate_id: 'rate_1a', amount_cents: 500 },
      { shipment_id: 'shp_2', rate_id: 'rate_2a', amount_cents: 625 },
    ],
  }]);
});

test('EasyPost adapter refuses non-test configuration before network access and rejects production responses', async () => {
  const { createEasyPostShipment } = await shipping();
  let calls = 0;
  const fakeFetch = async () => { calls += 1; return new Response('{}', { status: 200 }); };
  const request = { to_address: {}, from_address: {}, parcel: { length: 1, width: 1, height: 1, weight: 1 } };
  const blocked = await createEasyPostShipment(request, { mode: 'production', apiKey: 'secret', fetchImpl: fakeFetch });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'easypost_test_mode_required');
  assert.equal(calls, 0);

  const productionFetch = async () => new Response(JSON.stringify({ id: 'shp_live', mode: 'production', rates: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  const mismatch = await createEasyPostShipment(request, { mode: 'test', apiKey: 'secret', fetchImpl: productionFetch });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error, 'easypost_mode_mismatch');
});

test('Worker exposes public shipping rate route without weakening admin boundary', () => {
  const worker = read('src/worker.js');
  assert.match(worker, /\/api\/shipping\/rates/);
  assert.match(worker, /handleShippingRates/);
  assert.match(worker, /verifyAccessJwt/);
});

test('reservation and shipping code use the established MAYIONICS_DB binding', () => {
  assert.match(read('src/reservations.js'), /MAYIONICS_DB/);
  assert.doesNotMatch(read('src/reservations.js'), /env\?\.DB|env\.DB/);
});
