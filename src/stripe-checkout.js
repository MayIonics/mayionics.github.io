import { buildParcelUnits, combineParcelRates, createEasyPostShipment } from './shipping-rates.js';

const STRIPE_PAYMENT_INTENTS_URL = 'https://api.stripe.com/v1/payment_intents';
const MAX_RESERVATIONS = 10;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validIdempotencyKey(value) {
  return /^[A-Za-z0-9_-]{16,100}$/.test(value);
}

export function validateStripeCheckoutInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_body' };
  const allowed = new Set(['idempotency_key', 'reservation_tokens', 'shipping', 'customer']);
  if (Object.keys(input).some(key => !allowed.has(key))) return { ok: false, error: 'untrusted_checkout_field' };

  const idempotencyKey = cleanString(input.idempotency_key);
  if (!validIdempotencyKey(idempotencyKey)) return { ok: false, error: 'invalid_idempotency_key' };

  if (!Array.isArray(input.reservation_tokens) || input.reservation_tokens.length < 1 || input.reservation_tokens.length > MAX_RESERVATIONS) {
    return { ok: false, error: 'invalid_reservation_tokens' };
  }
  const reservationTokens = input.reservation_tokens.map(cleanString);
  if (reservationTokens.some(token => !token) || new Set(reservationTokens).size !== reservationTokens.length) {
    return { ok: false, error: 'invalid_reservation_tokens' };
  }

  const carrier = cleanString(input.shipping?.carrier);
  const service = cleanString(input.shipping?.service);
  if (!carrier || !service) return { ok: false, error: 'invalid_shipping_selection' };

  const name = cleanString(input.customer?.name);
  const email = cleanString(input.customer?.email).toLowerCase();
  if (!name || !validEmail(email)) return { ok: false, error: 'invalid_customer' };

  const address = input.customer?.address;
  if (!address || typeof address !== 'object' || Array.isArray(address)) return { ok: false, error: 'invalid_address' };
  const street1 = cleanString(address.street1);
  const city = cleanString(address.city);
  const state = cleanString(address.state).toUpperCase();
  const zip = cleanString(address.zip);
  const country = cleanString(address.country).toUpperCase();
  if (!street1 || !city || !state || !zip || country !== 'US') return { ok: false, error: 'invalid_address' };

  const normalizedAddress = { street1, city, state, zip, country };
  const street2 = cleanString(address.street2);
  if (street2) normalizedAddress.street2 = street2;

  return {
    ok: true,
    idempotency_key: idempotencyKey,
    reservation_tokens: reservationTokens,
    shipping: { carrier, service },
    customer: { name, email, address: normalizedAddress },
  };
}

export function calculateAuthoritativeSubtotal(reservationTokens, rows, now = new Date()) {
  if (!Array.isArray(reservationTokens) || !Array.isArray(rows)) return { ok: false, error: 'invalid_reservations' };
  const rowMap = new Map(rows.map(row => [row.reservation_token, row]));
  const items = [];
  let subtotal = 0;

  for (const token of reservationTokens) {
    const row = rowMap.get(token);
    if (!row) return { ok: false, error: 'reservation_not_found', reservation_token: token };
    if (row.reservation_status !== 'ACTIVE') return { ok: false, error: 'reservation_inactive', reservation_token: token };
    const expiry = Date.parse(row.expires_at);
    if (!Number.isFinite(expiry) || expiry <= now.getTime()) return { ok: false, error: 'reservation_expired', reservation_token: token };
    if (row.product_status !== 'ACTIVE') return { ok: false, error: 'product_unavailable', product_id: row.product_id };
    if (!Number.isInteger(row.reserved_quantity) || row.reserved_quantity < 1 || !Number.isInteger(row.price_cents) || row.price_cents < 0) {
      return { ok: false, error: 'invalid_authoritative_product', product_id: row.product_id };
    }
    const lineTotal = row.reserved_quantity * row.price_cents;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal + lineTotal)) return { ok: false, error: 'amount_overflow' };
    subtotal += lineTotal;
    items.push({
      reservation_token: token,
      product_id: row.product_id,
      product_title: row.product_title,
      quantity: row.reserved_quantity,
      unit_price_cents: row.price_cents,
      line_total_cents: lineTotal,
    });
  }

  return { ok: true, subtotal_cents: subtotal, items };
}

export async function createStripePaymentIntent(input, options = {}) {
  if (cleanString(options.mode).toLowerCase() !== 'test') return { ok: false, error: 'stripe_test_mode_required' };
  const secretKey = cleanString(options.secretKey);
  if (!secretKey) return { ok: false, error: 'stripe_not_configured' };
  if (!Number.isInteger(input?.amount_cents) || input.amount_cents < 50) return { ok: false, error: 'invalid_stripe_amount' };
  const fetchImpl = options.fetchImpl || fetch;

  const params = new URLSearchParams();
  params.set('amount', String(input.amount_cents));
  params.set('currency', 'usd');
  params.set('automatic_payment_methods[enabled]', 'true');
  params.set('metadata[order_id]', cleanString(input.order_id));
  params.set('metadata[order_number]', cleanString(input.order_number));
  if (cleanString(input.receipt_email)) params.set('receipt_email', cleanString(input.receipt_email));

  let response;
  try {
    response = await fetchImpl(STRIPE_PAYMENT_INTENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `mayionics:${cleanString(input.idempotency_key)}`,
      },
      body: params.toString(),
    });
  } catch {
    return { ok: false, error: 'stripe_unreachable' };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'stripe_invalid_response' };
  }
  if (!response.ok) return { ok: false, error: 'stripe_error', status: response.status };
  if (data?.livemode !== false) return { ok: false, error: 'stripe_mode_mismatch' };
  if (data?.amount !== input.amount_cents || data?.currency !== 'usd') return { ok: false, error: 'stripe_amount_mismatch' };
  if (!cleanString(data?.id) || !cleanString(data?.client_secret)) return { ok: false, error: 'stripe_invalid_response' };
  return { ok: true, payment_intent: data };
}

async function fingerprintCheckout(validated) {
  const canonical = JSON.stringify({
    reservation_tokens: [...validated.reservation_tokens].sort(),
    shipping: validated.shipping,
    customer: validated.customer,
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
  const quantityByProduct = new Map();
  const products = new Map();
  for (const row of rows) {
    quantityByProduct.set(row.product_id, (quantityByProduct.get(row.product_id) || 0) + row.reserved_quantity);
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
    items: [...quantityByProduct].map(([product_id, quantity]) => ({ product_id, quantity })),
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
  const quotes = combineParcelRates(shipments);
  const selected = quotes.find(quote => quote.carrier === validated.shipping.carrier && quote.service === validated.shipping.service && quote.currency === 'USD');
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

async function persistProviderIdentity(db, attempt, paymentIntent, amountCents) {
  const now = new Date().toISOString();
  const paymentId = `stripe:${paymentIntent.id}`;
  await db.batch([
    db.prepare(`
      INSERT OR IGNORE INTO payments (
        id, order_id, provider, provider_payment_id, amount_cents, status, created_at, updated_at
      ) VALUES (?, ?, 'STRIPE', ?, ?, 'PENDING', ?, ?)
    `).bind(paymentId, attempt.order_id, paymentIntent.id, amountCents, now, now),
    db.prepare(`
      UPDATE checkout_attempts
      SET provider_payment_id = ?, status = 'PENDING', updated_at = ?
      WHERE id = ? AND request_fingerprint = ?
    `).bind(paymentIntent.id, now, attempt.id, attempt.request_fingerprint),
  ]);
}

async function createPendingOrder(db, validated, fingerprint, subtotal, shippingQuote, rows) {
  const now = new Date().toISOString();
  const attemptId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const orderNumber = newOrderNumber();
  const totalCents = subtotal.subtotal_cents + shippingQuote.amount_cents;
  if (!Number.isSafeInteger(totalCents)) throw new Error('amount_overflow');

  const statements = [
    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_email, customer_name,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
        shipping_postal_code, shipping_country, subtotal_cents, shipping_amount_cents,
        total_cents, payment_provider, payment_status, order_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STRIPE', 'PENDING', 'PENDING', ?, ?)
    `).bind(
      orderId, orderNumber, validated.customer.email, validated.customer.name,
      validated.customer.address.street1, validated.customer.address.street2 || null,
      validated.customer.address.city, validated.customer.address.state, validated.customer.address.zip,
      validated.customer.address.country, subtotal.subtotal_cents, shippingQuote.amount_cents, totalCents, now, now,
    ),
    db.prepare(`
      INSERT INTO checkout_attempts (
        id, idempotency_key, request_fingerprint, order_id, provider, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'STRIPE', 'CREATING', ?, ?)
    `).bind(attemptId, validated.idempotency_key, fingerprint, orderId, now, now),
  ];

  for (const item of subtotal.items) {
    statements.push(db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_title, quantity, unit_price_cents, line_total_cents, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), orderId, item.product_id, item.product_title, item.quantity, item.unit_price_cents, item.line_total_cents, now));
  }

  for (const component of shippingQuote.components) {
    statements.push(db.prepare(`
      INSERT INTO shipments (
        id, order_id, provider, provider_shipment_id, provider_rate_id, carrier, service,
        shipping_cost_cents, status, created_at, updated_at
      ) VALUES (?, ?, 'EASYPOST', ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).bind(
      crypto.randomUUID(), orderId, component.shipment_id, component.rate_id,
      shippingQuote.carrier, shippingQuote.service, component.amount_cents, now, now,
    ));
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
    order_id: orderId,
    order_number: orderNumber,
    subtotal_cents: subtotal.subtotal_cents,
    shipping_amount_cents: shippingQuote.amount_cents,
    total_cents: totalCents,
    customer_email: validated.customer.email,
  };
}

async function failAttempt(db, attempt) {
  const now = new Date().toISOString();
  await db.prepare("UPDATE checkout_attempts SET status = 'FAILED', updated_at = ? WHERE id = ?")
    .bind(now, attempt.id)
    .run();
}

export async function handleStripeCheckout(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/payments/stripe/create') return json({ error: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const validated = validateStripeCheckoutInput(body);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const db = env?.MAYIONICS_DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);
  if (cleanString(env?.STRIPE_MODE).toLowerCase() !== 'test') return json({ error: 'stripe_test_mode_required' }, 503);
  if (!cleanString(env?.STRIPE_SECRET_KEY)) return json({ error: 'stripe_not_configured' }, 503);

  const fingerprint = await fingerprintCheckout(validated);
  let attempt = await loadAttempt(db, validated.idempotency_key);
  if (attempt && attempt.request_fingerprint !== fingerprint) return json({ error: 'checkout_idempotency_conflict' }, 409);

  if (!attempt) {
    const rows = await loadReservationRows(db, validated.reservation_tokens);
    const subtotal = calculateAuthoritativeSubtotal(validated.reservation_tokens, rows, new Date());
    if (!subtotal.ok) return json({ error: subtotal.error }, subtotal.error === 'reservation_not_found' ? 404 : 409);

    const shipping = await authoritativeShippingQuote(validated, rows, env);
    if (!shipping.ok) return json({ error: shipping.error }, shipping.error === 'shipping_selection_unavailable' ? 409 : 502);

    try {
      attempt = await createPendingOrder(db, validated, fingerprint, subtotal, shipping.quote, rows);
    } catch (error) {
      const message = String(error?.message || error).toLowerCase();
      const replay = await loadAttempt(db, validated.idempotency_key);
      if (replay) {
        if (replay.request_fingerprint !== fingerprint) return json({ error: 'checkout_idempotency_conflict' }, 409);
        attempt = replay;
      } else if (message.includes('unique') || message.includes('constraint')) {
        return json({ error: 'reservation_already_claimed' }, 409);
      } else {
        return json({ error: 'checkout_persistence_failed' }, 500);
      }
    }
  }

  const stripe = await createStripePaymentIntent({
    amount_cents: attempt.total_cents,
    order_id: attempt.order_id,
    order_number: attempt.order_number,
    receipt_email: attempt.customer_email,
    idempotency_key: validated.idempotency_key,
  }, { mode: env.STRIPE_MODE, secretKey: env.STRIPE_SECRET_KEY });

  if (!stripe.ok) {
    await failAttempt(db, attempt);
    return json({ error: stripe.error }, 502);
  }

  await persistProviderIdentity(db, attempt, stripe.payment_intent, attempt.total_cents);
  return json({
    order_number: attempt.order_number,
    payment_intent_id: stripe.payment_intent.id,
    client_secret: stripe.payment_intent.client_secret,
    subtotal_cents: attempt.subtotal_cents,
    shipping_amount_cents: attempt.shipping_amount_cents,
    total_cents: attempt.total_cents,
    currency: 'usd',
  }, 201);
}
