const MAX_RESERVATION_QUANTITY = 100;
const DEFAULT_TTL_SECONDS = 15 * 60;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function validateReservationInput(input) {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_body' };
  const productId = typeof input.product_id === 'string' ? input.product_id.trim() : '';
  const quantity = input.quantity;
  if (!productId) return { ok: false, reason: 'invalid_product_id' };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_RESERVATION_QUANTITY) {
    return { ok: false, reason: 'invalid_quantity' };
  }
  return { ok: true, product_id: productId, quantity };
}

function nowIso() {
  return new Date().toISOString();
}

function expiryIso(ttlSeconds = DEFAULT_TTL_SECONDS) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

async function createReservation(request, env) {
  if (!env?.DB) return json({ error: 'reservation_unavailable' }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const validated = validateReservationInput(body);
  if (!validated.ok) return json({ error: validated.reason }, 400);

  const createdAt = nowIso();
  const expiresAt = expiryIso();
  const id = crypto.randomUUID();
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;

  const expire = env.DB.prepare(
    "UPDATE product_reservations SET status = 'EXPIRED', updated_at = ? WHERE status = 'ACTIVE' AND expires_at <= ?",
  ).bind(createdAt, createdAt);

  const insert = env.DB.prepare(
    `INSERT INTO product_reservations (
      id, product_id, order_id, reservation_token, reserved_quantity,
      status, expires_at, created_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, 'ACTIVE', ?, ?, ?)`,
  ).bind(id, validated.product_id, token, validated.quantity, expiresAt, createdAt, createdAt);

  try {
    await env.DB.batch([expire, insert]);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes('reservation_capacity_exceeded')) {
      return json({ error: 'insufficient_inventory' }, 409);
    }
    if (message.includes('FOREIGN KEY')) return json({ error: 'product_not_found' }, 404);
    return json({ error: 'reservation_failed' }, 500);
  }

  return json({
    reservation_token: token,
    product_id: validated.product_id,
    quantity: validated.quantity,
    status: 'ACTIVE',
    expires_at: expiresAt,
  }, 201);
}

async function releaseReservation(token, env) {
  if (!env?.DB) return json({ error: 'reservation_unavailable' }, 503);
  if (!token) return json({ error: 'invalid_reservation_token' }, 400);
  const updatedAt = nowIso();
  const result = await env.DB.prepare(
    "UPDATE product_reservations SET status = 'RELEASED', updated_at = ? WHERE reservation_token = ? AND status = 'ACTIVE'",
  ).bind(updatedAt, token).run();
  const changes = result?.meta?.changes ?? result?.changes ?? 0;
  if (!changes) return json({ error: 'reservation_not_found' }, 404);
  return json({ released: true });
}

export async function handleReservations(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/reservations' && request.method === 'POST') {
    return createReservation(request, env);
  }

  const match = url.pathname.match(/^\/api\/reservations\/([^/]+)\/release$/);
  if (match && request.method === 'POST') {
    return releaseReservation(decodeURIComponent(match[1]), env);
  }

  return json({ error: 'not_found' }, 404);
}
