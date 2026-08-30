import { buildParcelUnits, combineParcelRates, createEasyPostShipment } from './shipping-rates.js';
import { validateStripeCheckoutInput, calculateAuthoritativeSubtotal } from './stripe-checkout.js';

const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function centsToPayPalValue(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export async function getPayPalAccessToken(options = {}) {
  if (cleanString(options.mode).toLowerCase() !== 'sandbox') {
    return { ok: false, error: 'paypal_sandbox_mode_required' };
  }
  const clientId = cleanString(options.clientId);
  const clientSecret = cleanString(options.clientSecret);
  if (!clientId || !clientSecret) return { ok: false, error: 'paypal_not_configured' };
  const fetchImpl = options.fetchImpl || fetch;

  let response;
  try {
    response = await fetchImpl(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
  } catch {
    return { ok: false, error: 'paypal_unreachable' };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'paypal_invalid_response' };
  }
  if (!response.ok) return { ok: false, error: 'paypal_auth_error', status: response.status };
  const accessToken = cleanString(data?.access_token);
  if (!accessToken) return { ok: false, error: 'paypal_invalid_response' };
  return { ok: true, access_token: accessToken, expires_in: data?.expires_in ?? null };
}

function validatePayPalOrderAmount(data, expectedCents) {
  const purchaseUnit = Array.isArray(data?.purchase_units) ? data.purchase_units[0] : null;
  if (!purchaseUnit?.amount) return true;
  const currency = cleanString(purchaseUnit.amount.currency_code).toUpperCase();
  const value = cleanString(purchaseUnit.amount.value);
  if (currency !== 'USD' || value !== centsToPayPalValue(expectedCents)) return false;
  return true;
}

export async function createPayPalOrder(input, options = {}) {
  if (cleanString(options.mode).toLowerCase() !== 'sandbox') {
    return { ok: false, error: 'paypal_sandbox_mode_required' };
  }
  const accessToken = cleanString(options.accessToken);
  if (!accessToken) return { ok: false, error: 'paypal_access_token_required' };

  const total = centsToPayPalValue(input?.total_cents);
  const subtotal = centsToPayPalValue(input?.subtotal_cents);
  const shipping = centsToPayPalValue(input?.shipping_amount_cents);
  const orderId = cleanString(input?.order_id);
  const orderNumber = cleanString(input?.order_number);
  const idempotencyKey = cleanString(input?.idempotency_key);
  if (total == null || subtotal == null || shipping == null || !orderId || !orderNumber || !idempotencyKey) {
    return { ok: false, error: 'invalid_paypal_order_input' };
  }
  if (input.subtotal_cents + input.shipping_amount_cents !== input.total_cents) {
    return { ok: false, error: 'invalid_paypal_order_input' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: orderId,
      custom_id: orderNumber,
      amount: {
        currency_code: 'USD',
        value: total,
        breakdown: {
          item_total: { currency_code: 'USD', value: subtotal },
          shipping: { currency_code: 'USD', value: shipping },
        },
      },
    }],
  };

  let response;
  try {
    response = await fetchImpl(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PayPal-Request-Id': `mayionics:create:${idempotencyKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'paypal_unreachable' };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'paypal_invalid_response' };
  }
  if (!response.ok) return { ok: false, error: 'paypal_create_error', status: response.status };
  if (!cleanString(data?.id)) return { ok: false, error: 'paypal_invalid_response' };
  if (!validatePayPalOrderAmount(data, input.total_cents)) return { ok: false, error: 'paypal_amount_mismatch' };
  return { ok: true, paypal_order: data };
}

export async function capturePayPalOrder(paypalOrderId, expectedAmountCents, accessToken, options = {}) {
  if (cleanString(options.mode).toLowerCase() !== 'sandbox') {
    return { ok: false, error: 'paypal_sandbox_mode_required' };
  }
  const orderId = cleanString(paypalOrderId);
  const token = cleanString(accessToken);
  const requestId = cleanString(options.requestId);
  if (!orderId || !token || !requestId || centsToPayPalValue(expectedAmountCents) == null) {
    return { ok: false, error: 'invalid_paypal_capture_input' };
  }
  const fetchImpl = options.fetchImpl || fetch;

  let response;
  try {
    response = await fetchImpl(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PayPal-Request-Id': requestId,
      },
      body: '{}',
    });
  } catch {
    return { ok: false, error: 'paypal_unreachable' };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'paypal_invalid_response' };
  }
  if (!response.ok) return { ok: false, error: 'paypal_capture_error', status: response.status };
  if (cleanString(data?.id) !== orderId) return { ok: false, error: 'paypal_order_identity_mismatch' };
  if (cleanString(data?.status).toUpperCase() !== 'COMPLETED') return { ok: false, error: 'paypal_capture_incomplete' };

  const captures = (Array.isArray(data?.purchase_units) ? data.purchase_units : [])
    .flatMap(unit => Array.isArray(unit?.payments?.captures) ? unit.payments.captures : []);
  if (captures.length !== 1) return { ok: false, error: 'paypal_capture_identity_invalid' };
  const capture = captures[0];
  if (!cleanString(capture?.id)) return { ok: false, error: 'paypal_capture_identity_invalid' };
  if (cleanString(capture?.status).toUpperCase() !== 'COMPLETED') return { ok: false, error: 'paypal_capture_incomplete' };
  if (cleanString(capture?.amount?.currency_code).toUpperCase() !== 'USD') return { ok: false, error: 'paypal_capture_currency_mismatch' };
  if (cleanString(capture?.amount?.value) !== centsToPayPalValue(expectedAmountCents)) {
    return { ok: false, error: 'paypal_capture_amount_mismatch' };
  }
  return { ok: true, paypal_order: data, capture };
}

export function validatePayPalCaptureInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_body' };
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== 'order_number' || keys[1] !== 'paypal_order_id') {
    return { ok: false, error: 'invalid_capture_fields' };
  }
  const orderNumber = cleanString(input.order_number);
  const paypalOrderId = cleanString(input.paypal_order_id);
  if (!orderNumber || !paypalOrderId) return { ok: false, error: 'invalid_capture_identity' };
  return { ok: true, order_number: orderNumber, paypal_order_id: paypalOrderId };
}

async function fingerprintCheckout(validated) {
  const canonical = JSON.stringify({
    reservation_tokens: [...validated.reservation_tokens].sort(),
    shipping: validated.shipping,
    customer: validated.customer,
    provider: 'PAYPAL',
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function parseShipFrom(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const address = JSON.parse(value);
    if (!address || typeof address !== 'object' || Array.isArray(address)) return null;
    for (const field of ['name', 'street1', 'city', 'state', 'zip', 'country']) {
      if (!cleanString(address[field])) return null;
    }
    if (cleanString(address.country).toUpperCase() !== 'US') return null;
    return address;
  } catch {
    return null;
  }
}

async function loadReservationRows(db, tokens) {
  const placeholders = tokens.map(() => '?').join(', ');
  const result = await db.prepare(`
    SELECT
      r.reservation_token,
      r.reserved_quantity,
      r.status AS reservation_status,
      r.expires_at,
      p.id AS product_id,
      p.title AS product_title,
      p.price_cents,
      p.status AS product_status,
      p.quantity AS product_quantity,
      p.weight_oz,
      p.length_in,
      p.width_in,
      p.height_in
    FROM product_reservations r
    JOIN products p ON p.id = r.product_id
    WHERE r.reservation_token IN (${placeholders})
  `).bind(...tokens).all();
  return result.results ?? [];
}

function shippingItemsAndProducts(rows) {
  const quantities = new Map();
  const products = new Map();
  for (const row of rows) {
    quantities.set(row.product_id, (quantities.get(row.product_id) || 0) + row.reserved_quantity);
    products.set(row.product_id, {
      id: row.product_id,
      status: row.product_status,
      quantity: row.product_quantity,
      weight_oz: row.weight_oz,
      length_in: row.length_in,
      width_in: row.width_in,
      height_in: row.height_in,
    });
  }
  return {
    items: [...quantities].map(([product_id, quantity]) => ({ product_id, quantity })),
    products: [...products.values()],
  };
}

async function authoritativeShippingQuote(validated, rows, env) {
  if (cleanString(env?.EASYPOST_MODE).toLowerCase() !== 'test') return { ok: false, error: 'easypost_test_mode_required' };
  if (!cleanString(env?.EASYPOST_API_KEY)) return { ok: false, error: 'easypost_not_configured' };
  const fromAddress = parseShipFrom(env?.MAYIONICS_SHIP_FROM_JSON);
  if (!fromAddress) return { ok: false, error: 'ship_from_not_configured' };
  const source = shippingItemsAndProducts(rows);
  const built = buildParcelUnits(source.items, source.products);
  if (!built.ok) return built;
  const toAddress = { name: validated.customer.name, email: validated.customer.email, ...validated.customer.address };
  const shipments = [];
  for (const parcel of built.parcels) {
    const rated = await createEasyPostShipment({
      to_address: toAddress,
      from_address: fromAddress,
      parcel: { length: parcel.length, width: parcel.width, height: parcel.height, weight: parcel.weight },
    }, { mode: env.EASYPOST_MODE, apiKey: env.EASYPOST_API_KEY });
    if (!rated.ok) return rated;
    shipments.push({ shipment_id: rated.shipment.id, rates: rated.shipment.rates });
  }
  const selected = combineParcelRates(shipments).find(quote =>
    quote.carrier === validated.shipping.carrier && quote.service === validated.shipping.service && quote.currency === 'USD');
  if (!selected) return { ok: false, error: 'shipping_selection_unavailable' };
  return { ok: true, quote: selected };
}

function newOrderNumber() {
  return `MAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

async function loadAttempt(db, idempotencyKey) {
  return db.prepare(`
    SELECT a.*, o.order_number, o.subtotal_cents, o.shipping_amount_cents, o.total_cents, o.customer_email
    FROM checkout_attempts a
    JOIN orders o ON o.id = a.order_id
    WHERE a.idempotency_key = ?
  `).bind(idempotencyKey).first();
}

async function createPendingOrder(db, validated, fingerprint, subtotal, quote) {
  const now = new Date().toISOString();
  const attemptId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const orderNumber = newOrderNumber();
  const totalCents = subtotal.subtotal_cents + quote.amount_cents;
  if (!Number.isSafeInteger(totalCents)) throw new Error('amount_overflow');

  const statements = [
    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_email, customer_name,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
        shipping_postal_code, shipping_country, subtotal_cents, shipping_amount_cents,
        total_cents, payment_provider, payment_status, order_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAYPAL', 'PENDING', 'PENDING', ?, ?)
    `).bind(
      orderId, orderNumber, validated.customer.email, validated.customer.name,
      validated.customer.address.street1, validated.customer.address.street2 || null,
      validated.customer.address.city, validated.customer.address.state, validated.customer.address.zip,
      validated.customer.address.country, subtotal.subtotal_cents, quote.amount_cents, totalCents, now, now,
    ),
    db.prepare(`
      INSERT INTO checkout_attempts (
        id, idempotency_key, request_fingerprint, order_id, provider, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PAYPAL', 'CREATING', ?, ?)
    `).bind(attemptId, validated.idempotency_key, fingerprint, orderId, now, now),
  ];

  for (const item of subtotal.items) {
    statements.push(db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_title, quantity, unit_price_cents, line_total_cents, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), orderId, item.product_id, item.product_title, item.quantity, item.unit_price_cents, item.line_total_cents, now));
  }
  for (const component of quote.components) {
    statements.push(db.prepare(`
      INSERT INTO shipments (
        id, order_id, provider, provider_shipment_id, provider_rate_id, carrier, service,
        shipping_cost_cents, status, created_at, updated_at
      ) VALUES (?, ?, 'EASYPOST', ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).bind(crypto.randomUUID(), orderId, component.shipment_id, component.rate_id, quote.carrier, quote.service, component.amount_cents, now, now));
  }
  for (const token of validated.reservation_tokens) {
    statements.push(db.prepare(`
      INSERT INTO checkout_reservation_claims (reservation_token, checkout_attempt_id, order_id, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(token, attemptId, orderId, now));
    statements.push(db.prepare(`
      UPDATE product_reservations SET order_id = ?, updated_at = ?
      WHERE reservation_token = ? AND status = 'ACTIVE' AND order_id IS NULL AND expires_at > ?
    `).bind(orderId, now, token, now));
  }
  await db.batch(statements);
  return {
    id: attemptId,
    idempotency_key: validated.idempotency_key,
    request_fingerprint: fingerprint,
    provider: 'PAYPAL',
    order_id: orderId,
    order_number: orderNumber,
    subtotal_cents: subtotal.subtotal_cents,
    shipping_amount_cents: quote.amount_cents,
    total_cents: totalCents,
    customer_email: validated.customer.email,
  };
}

async function storePayPalOrderIdentity(db, attempt, paypalOrderId) {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE checkout_attempts
    SET provider_payment_id = ?, status = 'PENDING', updated_at = ?
    WHERE id = ? AND provider = 'PAYPAL' AND request_fingerprint = ?
  `).bind(paypalOrderId, now, attempt.id, attempt.request_fingerprint).run();
}

async function createHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const validated = validateStripeCheckoutInput(body);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const db = env?.MAYIONICS_DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);
  if (cleanString(env?.PAYPAL_MODE).toLowerCase() !== 'sandbox') return json({ error: 'paypal_sandbox_mode_required' }, 503);
  if (!cleanString(env?.PAYPAL_CLIENT_ID) || !cleanString(env?.PAYPAL_CLIENT_SECRET)) return json({ error: 'paypal_not_configured' }, 503);

  const fingerprint = await fingerprintCheckout(validated);
  let attempt = await loadAttempt(db, validated.idempotency_key);
  if (attempt) {
    if (attempt.provider !== 'PAYPAL') return json({ error: 'checkout_provider_conflict' }, 409);
    if (attempt.request_fingerprint !== fingerprint) return json({ error: 'checkout_idempotency_conflict' }, 409);
  }

  if (!attempt) {
    const rows = await loadReservationRows(db, validated.reservation_tokens);
    const subtotal = calculateAuthoritativeSubtotal(validated.reservation_tokens, rows, new Date());
    if (!subtotal.ok) return json({ error: subtotal.error }, subtotal.error === 'reservation_not_found' ? 404 : 409);
    const shipping = await authoritativeShippingQuote(validated, rows, env);
    if (!shipping.ok) return json({ error: shipping.error }, shipping.error === 'shipping_selection_unavailable' ? 409 : 502);
    try {
      attempt = await createPendingOrder(db, validated, fingerprint, subtotal, shipping.quote);
    } catch (error) {
      const replay = await loadAttempt(db, validated.idempotency_key);
      if (replay) {
        if (replay.provider !== 'PAYPAL') return json({ error: 'checkout_provider_conflict' }, 409);
        if (replay.request_fingerprint !== fingerprint) return json({ error: 'checkout_idempotency_conflict' }, 409);
        attempt = replay;
      } else if (String(error?.message || error).toLowerCase().match(/unique|constraint/)) {
        return json({ error: 'reservation_already_claimed' }, 409);
      } else {
        return json({ error: 'checkout_persistence_failed' }, 500);
      }
    }
  }

  if (cleanString(attempt.provider_payment_id)) {
    return json({
      order_number: attempt.order_number,
      paypal_order_id: attempt.provider_payment_id,
      subtotal_cents: attempt.subtotal_cents,
      shipping_amount_cents: attempt.shipping_amount_cents,
      total_cents: attempt.total_cents,
      currency: 'USD',
    }, 200);
  }

  const auth = await getPayPalAccessToken({
    mode: env.PAYPAL_MODE,
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
  });
  if (!auth.ok) return json({ error: auth.error }, 502);

  const created = await createPayPalOrder({
    total_cents: attempt.total_cents,
    subtotal_cents: attempt.subtotal_cents,
    shipping_amount_cents: attempt.shipping_amount_cents,
    order_id: attempt.order_id,
    order_number: attempt.order_number,
    idempotency_key: validated.idempotency_key,
  }, { mode: env.PAYPAL_MODE, accessToken: auth.access_token });
  if (!created.ok) return json({ error: created.error }, 502);

  await storePayPalOrderIdentity(db, attempt, created.paypal_order.id);
  return json({
    order_number: attempt.order_number,
    paypal_order_id: created.paypal_order.id,
    subtotal_cents: attempt.subtotal_cents,
    shipping_amount_cents: attempt.shipping_amount_cents,
    total_cents: attempt.total_cents,
    currency: 'USD',
  }, 201);
}

async function captureHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const validated = validatePayPalCaptureInput(body);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const db = env?.MAYIONICS_DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);
  if (cleanString(env?.PAYPAL_MODE).toLowerCase() !== 'sandbox') return json({ error: 'paypal_sandbox_mode_required' }, 503);
  if (!cleanString(env?.PAYPAL_CLIENT_ID) || !cleanString(env?.PAYPAL_CLIENT_SECRET)) return json({ error: 'paypal_not_configured' }, 503);

  const attempt = await db.prepare(`
    SELECT a.id, a.order_id, a.provider, a.provider_payment_id, o.order_number, o.total_cents
    FROM checkout_attempts a
    JOIN orders o ON o.id = a.order_id
    WHERE o.order_number = ? AND a.provider = 'PAYPAL'
  `).bind(validated.order_number).first();
  if (!attempt) return json({ error: 'paypal_checkout_not_found' }, 404);
  if (attempt.provider_payment_id !== validated.paypal_order_id) return json({ error: 'paypal_order_identity_mismatch' }, 409);

  const existing = await db.prepare(`
    SELECT provider_payment_id, amount_cents, status
    FROM payments
    WHERE order_id = ? AND provider = 'PAYPAL'
    ORDER BY created_at DESC LIMIT 1
  `).bind(attempt.order_id).first();
  if (existing) {
    return json({
      order_number: attempt.order_number,
      paypal_order_id: attempt.provider_payment_id,
      capture_id: existing.provider_payment_id,
      amount_cents: existing.amount_cents,
      currency: 'USD',
      status: existing.status,
    });
  }

  const auth = await getPayPalAccessToken({
    mode: env.PAYPAL_MODE,
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
  });
  if (!auth.ok) return json({ error: auth.error }, 502);

  const captured = await capturePayPalOrder(attempt.provider_payment_id, attempt.total_cents, auth.access_token, {
    mode: env.PAYPAL_MODE,
    requestId: `mayionics:capture:${attempt.order_id}`,
  });
  if (!captured.ok) return json({ error: captured.error }, 502);

  const now = new Date().toISOString();
  const paymentId = `paypal:${captured.capture.id}`;
  await db.prepare(`
    INSERT OR IGNORE INTO payments (
      id, order_id, provider, provider_payment_id, amount_cents, status, created_at, updated_at
    ) VALUES (?, ?, 'PAYPAL', ?, ?, 'PENDING', ?, ?)
  `).bind(paymentId, attempt.order_id, captured.capture.id, attempt.total_cents, now, now).run();

  return json({
    order_number: attempt.order_number,
    paypal_order_id: attempt.provider_payment_id,
    capture_id: captured.capture.id,
    amount_cents: attempt.total_cents,
    currency: 'USD',
    status: 'PENDING',
  }, 201);
}

export async function handlePayPalCheckout(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/payments/paypal/create') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    return createHandler(request, env);
  }
  if (url.pathname === '/api/payments/paypal/capture') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    return captureHandler(request, env);
  }
  return json({ error: 'not_found' }, 404);
}
