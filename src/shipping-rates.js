const MAX_PARCEL_UNITS = 10;
const EASYPOST_SHIPMENTS_URL = 'https://api.easypost.com/v2/shipments';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function validateShippingRateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_body' };
  if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false, error: 'invalid_items' };

  const items = [];
  let units = 0;
  for (const item of input.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: 'invalid_item' };
    const keys = Object.keys(item).sort();
    if (keys.length !== 2 || keys[0] !== 'product_id' || keys[1] !== 'quantity') return { ok: false, error: 'invalid_item_fields' };
    const productId = cleanString(item.product_id);
    if (!productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_PARCEL_UNITS) {
      return { ok: false, error: 'invalid_item' };
    }
    units += item.quantity;
    if (units > MAX_PARCEL_UNITS) return { ok: false, error: 'too_many_parcels' };
    items.push({ product_id: productId, quantity: item.quantity });
  }

  const address = input.to_address;
  if (!address || typeof address !== 'object' || Array.isArray(address)) return { ok: false, error: 'invalid_address' };
  const required = ['name', 'street1', 'city', 'state', 'zip', 'country'];
  for (const field of required) {
    if (!cleanString(address[field])) return { ok: false, error: `invalid_${field}` };
  }
  const country = cleanString(address.country).toUpperCase();
  if (country !== 'US') return { ok: false, error: 'unsupported_country' };

  const to_address = {
    name: cleanString(address.name),
    street1: cleanString(address.street1),
    city: cleanString(address.city),
    state: cleanString(address.state).toUpperCase(),
    zip: cleanString(address.zip),
    country,
  };
  for (const optional of ['street2', 'phone', 'email']) {
    const value = cleanString(address[optional]);
    if (value) to_address[optional] = value;
  }

  return { ok: true, items, to_address, parcel_count: units };
}

export function buildParcelUnits(items, products) {
  const productMap = new Map((Array.isArray(products) ? products : []).map(product => [product.id, product]));
  const parcels = [];
  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) return { ok: false, error: 'product_not_found', product_id: item.product_id };
    if (product.status !== 'ACTIVE') return { ok: false, error: 'product_unavailable', product_id: item.product_id };
    if (!Number.isInteger(product.quantity) || product.quantity < item.quantity) {
      return { ok: false, error: 'insufficient_inventory', product_id: item.product_id };
    }
    const dimensions = [product.length_in, product.width_in, product.height_in, product.weight_oz];
    if (!dimensions.every(validPositiveNumber)) return { ok: false, error: 'shipping_dimensions_missing', product_id: item.product_id };
    for (let index = 0; index < item.quantity; index += 1) {
      parcels.push({
        product_id: item.product_id,
        length: product.length_in,
        width: product.width_in,
        height: product.height_in,
        weight: product.weight_oz,
      });
    }
  }
  return { ok: true, parcels };
}

export function rateStringToCents(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0') || '0', 10);
  return Number.isSafeInteger(cents) ? cents : null;
}

function normalizedRate(rate) {
  const amount_cents = rateStringToCents(rate?.rate);
  const carrier = cleanString(rate?.carrier);
  const service = cleanString(rate?.service);
  const currency = cleanString(rate?.currency).toUpperCase();
  const rate_id = cleanString(rate?.id);
  if (!rate_id || !carrier || !service || !currency || amount_cents == null) return null;
  return {
    rate_id,
    carrier,
    service,
    currency,
    amount_cents,
    delivery_days: Number.isInteger(rate.delivery_days) && rate.delivery_days >= 0 ? rate.delivery_days : null,
  };
}

export function combineParcelRates(shipments) {
  if (!Array.isArray(shipments) || shipments.length === 0) return [];
  const maps = shipments.map(shipment => {
    const shipmentId = cleanString(shipment?.shipment_id);
    const map = new Map();
    if (!shipmentId) return map;
    for (const rawRate of Array.isArray(shipment.rates) ? shipment.rates : []) {
      const rate = normalizedRate(rawRate);
      if (!rate) continue;
      const key = `${rate.carrier}\u0000${rate.service}\u0000${rate.currency}`;
      if (!map.has(key) || rate.amount_cents < map.get(key).amount_cents) map.set(key, { ...rate, shipment_id: shipmentId });
    }
    return map;
  });

  const firstKeys = [...maps[0].keys()];
  const quotes = [];
  for (const key of firstKeys) {
    if (!maps.every(map => map.has(key))) continue;
    const rates = maps.map(map => map.get(key));
    quotes.push({
      carrier: rates[0].carrier,
      service: rates[0].service,
      currency: rates[0].currency,
      amount_cents: rates.reduce((sum, rate) => sum + rate.amount_cents, 0),
      delivery_days: rates.every(rate => rate.delivery_days != null)
        ? Math.max(...rates.map(rate => rate.delivery_days))
        : null,
      components: rates.map(rate => ({
        shipment_id: rate.shipment_id,
        rate_id: rate.rate_id,
        amount_cents: rate.amount_cents,
      })),
    });
  }
  return quotes.sort((a, b) => a.amount_cents - b.amount_cents);
}

export async function createEasyPostShipment(shipmentInput, options = {}) {
  const mode = cleanString(options.mode).toLowerCase();
  if (mode !== 'test') return { ok: false, error: 'easypost_test_mode_required' };
  const apiKey = cleanString(options.apiKey);
  if (!apiKey) return { ok: false, error: 'easypost_not_configured' };
  const fetchImpl = options.fetchImpl || fetch;

  let response;
  try {
    response = await fetchImpl(EASYPOST_SHIPMENTS_URL, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${apiKey}:`)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ shipment: shipmentInput }),
    });
  } catch {
    return { ok: false, error: 'easypost_unreachable' };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'easypost_invalid_response' };
  }
  if (!response.ok) return { ok: false, error: 'easypost_error', status: response.status };
  if (data?.mode !== 'test') return { ok: false, error: 'easypost_mode_mismatch' };
  if (!cleanString(data?.id) || !Array.isArray(data?.rates)) return { ok: false, error: 'easypost_invalid_response' };
  return { ok: true, shipment: data };
}

function parseShipFrom(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    for (const field of ['name', 'street1', 'city', 'state', 'zip', 'country']) {
      if (!cleanString(parsed[field])) return null;
    }
    if (cleanString(parsed.country).toUpperCase() !== 'US') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function loadProducts(db, ids) {
  const placeholders = ids.map(() => '?').join(', ');
  const result = await db.prepare(
    `SELECT id, status, quantity, weight_oz, length_in, width_in, height_in FROM products WHERE id IN (${placeholders})`,
  ).bind(...ids).all();
  return result.results ?? [];
}

export async function handleShippingRates(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/shipping/rates') return json({ error: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const validated = validateShippingRateInput(body);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const db = env?.MAYIONICS_DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);
  if (cleanString(env?.EASYPOST_MODE).toLowerCase() !== 'test') return json({ error: 'easypost_test_mode_required' }, 503);
  if (!cleanString(env?.EASYPOST_API_KEY)) return json({ error: 'easypost_not_configured' }, 503);
  const fromAddress = parseShipFrom(env?.MAYIONICS_SHIP_FROM_JSON);
  if (!fromAddress) return json({ error: 'ship_from_not_configured' }, 503);

  const ids = [...new Set(validated.items.map(item => item.product_id))];
  const products = await loadProducts(db, ids);
  const built = buildParcelUnits(validated.items, products);
  if (!built.ok) {
    const status = built.error === 'product_not_found' ? 404 : built.error === 'insufficient_inventory' ? 409 : 422;
    return json({ error: built.error, product_id: built.product_id }, status);
  }

  const shipments = [];
  for (const parcel of built.parcels) {
    const result = await createEasyPostShipment({
      to_address: validated.to_address,
      from_address: fromAddress,
      parcel: { length: parcel.length, width: parcel.width, height: parcel.height, weight: parcel.weight },
    }, { mode: env.EASYPOST_MODE, apiKey: env.EASYPOST_API_KEY });
    if (!result.ok) return json({ error: result.error }, 502);
    shipments.push({ shipment_id: result.shipment.id, rates: result.shipment.rates });
  }

  const quotes = combineParcelRates(shipments);
  if (!quotes.length) return json({ error: 'no_shipping_rates' }, 502);
  return json({ parcel_count: built.parcels.length, quotes });
}
