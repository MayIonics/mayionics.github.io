import { getPayPalAccessToken, centsToPayPalValue } from './paypal-checkout.js';

const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const STRIPE_TOLERANCE_SECONDS = 300;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualText(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function parseStripeSignatureHeader(header) {
  const values = { t: null, v1: [] };
  for (const part of cleanString(header).split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't' && /^\d+$/.test(value || '')) values.t = Number(value);
    if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value || '')) values.v1.push(value.toLowerCase());
  }
  return values;
}

export async function verifyStripeWebhookSignature(rawBody, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = STRIPE_TOLERANCE_SECONDS) {
  const webhookSecret = cleanString(secret);
  if (!webhookSecret) return { ok: false, error: 'stripe_webhook_not_configured' };
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!Number.isSafeInteger(parsed.t) || parsed.v1.length === 0) return { ok: false, error: 'stripe_signature_invalid' };
  if (Math.abs(nowSeconds - parsed.t) > toleranceSeconds) return { ok: false, error: 'stripe_signature_stale' };
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new TextEncoder().encode(`${parsed.t}.${rawBody}`);
  const expected = hex(await crypto.subtle.sign('HMAC', key, signed));
  if (!parsed.v1.some(value => timingSafeEqualText(value, expected))) return { ok: false, error: 'stripe_signature_invalid' };
  return { ok: true, timestamp: parsed.t };
}

export async function verifyPayPalWebhookSignature(event, headers, options = {}) {
  if (cleanString(options.mode).toLowerCase() !== 'sandbox') return { ok: false, error: 'paypal_sandbox_mode_required' };
  const webhookId = cleanString(options.webhookId);
  if (!webhookId) return { ok: false, error: 'paypal_webhook_not_configured' };
  const auth = await getPayPalAccessToken({
    mode: options.mode,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    fetchImpl: options.fetchImpl,
  });
  if (!auth.ok) return auth;

  const transmissionId = cleanString(headers.get('paypal-transmission-id'));
  const transmissionTime = cleanString(headers.get('paypal-transmission-time'));
  const certUrl = cleanString(headers.get('paypal-cert-url'));
  const authAlgo = cleanString(headers.get('paypal-auth-algo'));
  const transmissionSig = cleanString(headers.get('paypal-transmission-sig'));
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return { ok: false, error: 'paypal_signature_headers_missing' };
  }

  const fetchImpl = options.fetchImpl || fetch;
  let response;
  try {
    response = await fetchImpl(`${PAYPAL_SANDBOX_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
  } catch {
    return { ok: false, error: 'paypal_unreachable' };
  }
  let data;
  try { data = await response.json(); } catch { return { ok: false, error: 'paypal_invalid_response' }; }
  if (!response.ok) return { ok: false, error: 'paypal_verify_error', status: response.status };
  if (cleanString(data?.verification_status).toUpperCase() !== 'SUCCESS') return { ok: false, error: 'paypal_signature_invalid' };
  return { ok: true };
}

function decimalUsdToCents(value) {
  const text = cleanString(value);
  if (!/^\d+\.\d{2}$/.test(text)) return null;
  const [whole, fraction] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function normalizeProviderEvent(provider, event) {
  const normalizedProvider = cleanString(provider).toUpperCase();
  const eventId = cleanString(event?.id);
  if (!eventId) return { ok: false, error: 'invalid_event_identity' };

  if (normalizedProvider === 'STRIPE') {
    if (event?.livemode !== false) return { ok: false, error: 'stripe_test_event_required' };
    const type = cleanString(event?.type);
    const outcome = type === 'payment_intent.succeeded'
      ? 'SUCCEEDED'
      : (type === 'payment_intent.payment_failed' || type === 'payment_intent.canceled' ? 'FAILED' : null);
    if (!outcome) return { ok: false, error: 'unsupported_event' };
    const object = event?.data?.object;
    const paymentId = cleanString(object?.id);
    const amount = outcome === 'SUCCEEDED' && Number.isInteger(object?.amount_received) ? object.amount_received : object?.amount;
    const currency = cleanString(object?.currency).toUpperCase();
    const orderId = cleanString(object?.metadata?.order_id);
    if (!paymentId || !orderId || !Number.isSafeInteger(amount) || amount < 0) return { ok: false, error: 'invalid_event_amount' };
    if (currency !== 'USD') return { ok: false, error: 'invalid_event_currency' };
    return { ok: true, provider: 'STRIPE', event_id: eventId, event_type: type, outcome, provider_payment_id: paymentId, order_id: orderId, amount_cents: amount, currency };
  }

  if (normalizedProvider === 'PAYPAL') {
    const type = cleanString(event?.event_type).toUpperCase();
    const outcome = type === 'PAYMENT.CAPTURE.COMPLETED'
      ? 'SUCCEEDED'
      : (type === 'PAYMENT.CAPTURE.DENIED' ? 'FAILED' : null);
    if (!outcome) return { ok: false, error: 'unsupported_event' };
    const resource = event?.resource;
    const paymentId = cleanString(resource?.id);
    const currency = cleanString(resource?.amount?.currency_code).toUpperCase();
    const amount = decimalUsdToCents(resource?.amount?.value);
    if (!paymentId || amount == null) return { ok: false, error: 'invalid_event_amount' };
    if (currency !== 'USD') return { ok: false, error: 'invalid_event_currency' };
    const orderId = cleanString(resource?.custom_id) || null;
    return { ok: true, provider: 'PAYPAL', event_id: eventId, event_type: type, outcome, provider_payment_id: paymentId, order_id: orderId, amount_cents: amount, currency };
  }

  return { ok: false, error: 'unsupported_provider' };
}

async function sha256Text(value) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function loadPaymentContext(db, event) {
  return db.prepare(`
    SELECT
      p.id AS payment_id, p.order_id, p.provider, p.provider_payment_id,
      p.amount_cents, p.status AS payment_status,
      o.total_cents, o.payment_status AS order_payment_status, o.order_status
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.provider = ? AND p.provider_payment_id = ?
  `).bind(event.provider, event.provider_payment_id).first();
}

async function existingWebhook(db, event) {
  return db.prepare(`
    SELECT provider_event_id, provider_payment_id, outcome, result
    FROM webhook_events
    WHERE provider = ? AND provider_event_id = ?
  `).bind(event.provider, event.event_id).first();
}

async function loadReservationsForOrder(db, orderId) {
  const result = await db.prepare(`
    SELECT r.reservation_token, r.product_id, r.reserved_quantity, r.status
    FROM product_reservations r
    JOIN checkout_reservation_claims c ON c.reservation_token = r.reservation_token
    WHERE c.order_id = ? AND r.order_id = ?
    ORDER BY r.created_at ASC
  `).bind(orderId, orderId).all();
  return result.results ?? [];
}

function webhookInsert(db, event, payloadHash, result, now) {
  return db.prepare(`
    INSERT INTO webhook_events (
      id, provider, provider_event_id, event_type, provider_payment_id,
      outcome, payload_hash, result, processed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), event.provider, event.event_id, event.event_type, event.provider_payment_id, event.outcome, payloadHash, result, now, now);
}

async function reconcileEvent(db, event, payloadHash) {
  const duplicate = await existingWebhook(db, event);
  if (duplicate) {
    if (duplicate.provider_payment_id !== event.provider_payment_id || duplicate.outcome !== event.outcome) {
      return { ok: false, error: 'webhook_replay_conflict', status: 409 };
    }
    return { ok: true, idempotent: true, result: duplicate.result };
  }

  const context = await loadPaymentContext(db, event);
  if (!context) return { ok: false, error: 'payment_not_found', status: 404 };
  if (context.provider !== event.provider || context.provider_payment_id !== event.provider_payment_id) {
    return { ok: false, error: 'provider_identity_mismatch', status: 409 };
  }
  if (event.order_id && event.provider === 'STRIPE' && event.order_id !== context.order_id) {
    return { ok: false, error: 'order_identity_mismatch', status: 409 };
  }
  if (context.amount_cents !== event.amount_cents || context.total_cents !== event.amount_cents || event.currency !== 'USD') {
    return { ok: false, error: 'payment_amount_mismatch', status: 409 };
  }

  const now = new Date().toISOString();
  if (event.outcome === 'SUCCEEDED') {
    if (context.payment_status === 'SUCCEEDED' && context.order_payment_status === 'PAID' && ['PAID', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'].includes(context.order_status)) {
      await db.batch([webhookInsert(db, event, payloadHash, 'IDEMPOTENT', now)]);
      return { ok: true, idempotent: true, result: 'IDEMPOTENT' };
    }
    if (context.payment_status !== 'PENDING' || context.order_payment_status !== 'PENDING' || context.order_status !== 'PENDING') {
      return { ok: false, error: 'payment_state_conflict', status: 409 };
    }

    const reservations = await loadReservationsForOrder(db, context.order_id);
    if (reservations.length === 0 || reservations.some(row => row.status !== 'ACTIVE')) {
      return { ok: false, error: 'reservation_state_conflict', status: 409 };
    }

    const statements = [webhookInsert(db, event, payloadHash, 'APPLIED', now)];
    for (const reservation of reservations) {
      statements.push(db.prepare(`
        UPDATE products
        SET quantity = quantity - ?,
            status = CASE WHEN quantity - ? = 0 THEN 'SOLD' ELSE status END,
            updated_at = ?
        WHERE id = ?
      `).bind(reservation.reserved_quantity, reservation.reserved_quantity, now, reservation.product_id));
      statements.push(db.prepare(`
        UPDATE product_reservations
        SET status = 'CONSUMED', updated_at = ?
        WHERE reservation_token = ? AND order_id = ? AND status = 'ACTIVE'
      `).bind(now, reservation.reservation_token, context.order_id));
    }
    statements.push(db.prepare(`UPDATE payments SET status = 'SUCCEEDED', updated_at = ? WHERE id = ? AND status = 'PENDING'`).bind(now, context.payment_id));
    statements.push(db.prepare(`
      UPDATE orders SET payment_status = 'PAID', order_status = 'PAID', updated_at = ?
      WHERE id = ? AND payment_status = 'PENDING' AND order_status = 'PENDING'
    `).bind(now, context.order_id));
    await db.batch(statements);
    return { ok: true, idempotent: false, result: 'APPLIED' };
  }

  if (context.payment_status === 'FAILED' && context.order_payment_status === 'FAILED' && context.order_status === 'CANCELLED') {
    await db.batch([webhookInsert(db, event, payloadHash, 'IDEMPOTENT', now)]);
    return { ok: true, idempotent: true, result: 'IDEMPOTENT' };
  }
  if (context.payment_status !== 'PENDING' || context.order_payment_status !== 'PENDING' || context.order_status !== 'PENDING') {
    return { ok: false, error: 'payment_state_conflict', status: 409 };
  }
  await db.batch([
    webhookInsert(db, event, payloadHash, 'APPLIED', now),
    db.prepare(`UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'PENDING'`).bind(now, context.payment_id),
    db.prepare(`
      UPDATE orders SET payment_status = 'FAILED', order_status = 'CANCELLED', updated_at = ?
      WHERE id = ? AND payment_status = 'PENDING' AND order_status = 'PENDING'
    `).bind(now, context.order_id),
  ]);
  return { ok: true, idempotent: false, result: 'APPLIED' };
}

async function stripeWebhook(request, env) {
  if (cleanString(env?.STRIPE_MODE).toLowerCase() !== 'test') return json({ error: 'stripe_test_mode_required' }, 503);
  const raw = await request.text();
  const verified = await verifyStripeWebhookSignature(raw, request.headers.get('stripe-signature'), env?.STRIPE_WEBHOOK_SECRET);
  if (!verified.ok) return json({ error: verified.error }, 400);
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400); }
  const normalized = normalizeProviderEvent('STRIPE', event);
  if (!normalized.ok) return json({ error: normalized.error }, 400);
  const reconciled = await reconcileEvent(env.MAYIONICS_DB, normalized, await sha256Text(raw));
  if (!reconciled.ok) return json({ error: reconciled.error }, reconciled.status || 409);
  return json({ received: true, idempotent: reconciled.idempotent, result: reconciled.result });
}

async function paypalWebhook(request, env) {
  if (cleanString(env?.PAYPAL_MODE).toLowerCase() !== 'sandbox') return json({ error: 'paypal_sandbox_mode_required' }, 503);
  const raw = await request.text();
  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400); }
  const verified = await verifyPayPalWebhookSignature(event, request.headers, {
    mode: env.PAYPAL_MODE,
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    webhookId: env.PAYPAL_WEBHOOK_ID,
  });
  if (!verified.ok) return json({ error: verified.error }, 400);
  const normalized = normalizeProviderEvent('PAYPAL', event);
  if (!normalized.ok) return json({ error: normalized.error }, 400);
  const reconciled = await reconcileEvent(env.MAYIONICS_DB, normalized, await sha256Text(raw));
  if (!reconciled.ok) return json({ error: reconciled.error }, reconciled.status || 409);
  return json({ received: true, idempotent: reconciled.idempotent, result: reconciled.result });
}

export async function handlePaymentWebhook(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!env?.MAYIONICS_DB) return json({ error: 'database_not_configured' }, 503);
  const path = new URL(request.url).pathname;
  if (path === '/api/webhooks/stripe') return stripeWebhook(request, env);
  if (path === '/api/webhooks/paypal') return paypalWebhook(request, env);
  return json({ error: 'not_found' }, 404);
}
