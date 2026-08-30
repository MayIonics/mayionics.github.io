const EASYPOST_API_BASE = 'https://api.easypost.com/v2';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function buyEasyPostTestLabel(input, options = {}) {
  if (cleanString(options.mode).toLowerCase() !== 'test') return { ok: false, error: 'easypost_test_mode_required' };
  const apiKey = cleanString(options.apiKey);
  const shipmentId = cleanString(input?.shipment_id);
  const rateId = cleanString(input?.rate_id);
  if (!apiKey) return { ok: false, error: 'easypost_not_configured' };
  if (!shipmentId || !rateId) return { ok: false, error: 'invalid_label_input' };

  const fetchImpl = options.fetchImpl || fetch;
  let response;
  try {
    response = await fetchImpl(`${EASYPOST_API_BASE}/shipments/${encodeURIComponent(shipmentId)}/buy`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ rate: { id: rateId } }),
    });
  } catch {
    return { ok: false, error: 'easypost_unreachable' };
  }

  let data;
  try { data = await response.json(); } catch { return { ok: false, error: 'easypost_invalid_response' }; }
  if (!response.ok) return { ok: false, error: 'easypost_label_error', status: response.status };
  if (cleanString(data?.mode).toLowerCase() !== 'test') return { ok: false, error: 'easypost_mode_mismatch' };
  if (cleanString(data?.id) !== shipmentId) return { ok: false, error: 'easypost_shipment_identity_mismatch' };
  const tracking = cleanString(data?.tracking_code);
  const labelUrl = cleanString(data?.postage_label?.label_url);
  if (!tracking || !labelUrl) return { ok: false, error: 'easypost_label_metadata_missing' };
  return { ok: true, shipment_id: shipmentId, tracking_number: tracking, label_url: labelUrl };
}

async function loadOrder(db, orderId) {
  return db.prepare(`
    SELECT id, order_number, customer_email, customer_name,
           shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
           shipping_postal_code, shipping_country, subtotal_cents, shipping_amount_cents,
           total_cents, payment_provider, payment_status, order_status, created_at, updated_at
    FROM orders WHERE id = ?
  `).bind(orderId).first();
}

async function loadShipments(db, orderId) {
  const result = await db.prepare(`
    SELECT id, order_id, provider, provider_shipment_id, provider_rate_id, carrier, service,
           shipping_cost_cents, tracking_number, label_url, status, created_at, updated_at
    FROM shipments WHERE order_id = ? ORDER BY created_at ASC
  `).bind(orderId).all();
  return result.results ?? [];
}

async function listOrders(db) {
  const result = await db.prepare(`
    SELECT id, order_number, customer_email, customer_name, total_cents,
           payment_provider, payment_status, order_status, created_at, updated_at
    FROM orders ORDER BY created_at DESC LIMIT 200
  `).all();
  return result.results ?? [];
}

async function orderDetail(db, orderId) {
  const order = await loadOrder(db, orderId);
  if (!order) return null;
  const [itemsResult, paymentsResult, shipments] = await Promise.all([
    db.prepare(`SELECT id, product_id, product_title, quantity, unit_price_cents, line_total_cents FROM order_items WHERE order_id = ? ORDER BY created_at ASC`).bind(orderId).all(),
    db.prepare(`SELECT id, provider, provider_payment_id, amount_cents, status, created_at, updated_at FROM payments WHERE order_id = ? ORDER BY created_at ASC`).bind(orderId).all(),
    loadShipments(db, orderId),
  ]);
  return { order, items: itemsResult.results ?? [], payments: paymentsResult.results ?? [], shipments };
}

async function claimShipment(db, shipment) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const inserted = await db.prepare(`
    INSERT OR IGNORE INTO label_purchase_attempts (
      id, shipment_id, status, provider_shipment_id, provider_rate_id, created_at, updated_at
    ) VALUES (?, ?, 'CLAIMED', ?, ?, ?, ?)
  `).bind(id, shipment.id, shipment.provider_shipment_id, shipment.provider_rate_id, now, now).run();
  const changes = inserted?.meta?.changes ?? inserted?.changes ?? 0;
  if (changes) return { ok: true, id };

  const existing = await db.prepare(`SELECT id, status, provider_shipment_id, provider_rate_id FROM label_purchase_attempts WHERE shipment_id = ?`).bind(shipment.id).first();
  if (!existing) return { ok: false, error: 'label_claim_failed' };
  if (existing.provider_shipment_id !== shipment.provider_shipment_id || existing.provider_rate_id !== shipment.provider_rate_id) {
    return { ok: false, error: 'label_claim_identity_conflict' };
  }
  if (existing.status === 'COMPLETED') return { ok: true, id: existing.id, completed: true };
  if (existing.status === 'CLAIMED') return { ok: false, error: 'label_purchase_in_progress' };

  const retry = await db.prepare(`UPDATE label_purchase_attempts SET status = 'CLAIMED', updated_at = ? WHERE id = ? AND status = 'FAILED'`).bind(now, existing.id).run();
  const retryChanges = retry?.meta?.changes ?? retry?.changes ?? 0;
  return retryChanges ? { ok: true, id: existing.id } : { ok: false, error: 'label_purchase_in_progress' };
}

async function buyLabels(db, orderId, env) {
  const order = await loadOrder(db, orderId);
  if (!order) return { ok: false, status: 404, error: 'order_not_found' };
  if (order.payment_status !== 'PAID' || !['PAID', 'READY_TO_SHIP'].includes(order.order_status)) {
    return { ok: false, status: 409, error: 'order_not_ready_for_label' };
  }
  if (cleanString(env?.EASYPOST_MODE).toLowerCase() !== 'test') return { ok: false, status: 503, error: 'easypost_test_mode_required' };
  if (!cleanString(env?.EASYPOST_API_KEY)) return { ok: false, status: 503, error: 'easypost_not_configured' };

  const shipments = await loadShipments(db, orderId);
  if (!shipments.length) return { ok: false, status: 409, error: 'shipment_not_found' };

  for (const shipment of shipments) {
    if (shipment.status === 'LABEL_CREATED' && shipment.tracking_number && shipment.label_url) continue;
    if (shipment.status !== 'PENDING' || shipment.provider !== 'EASYPOST' || !shipment.provider_shipment_id || !shipment.provider_rate_id) {
      return { ok: false, status: 409, error: 'shipment_not_label_eligible' };
    }

    const claim = await claimShipment(db, shipment);
    if (!claim.ok) return { ok: false, status: 409, error: claim.error };
    if (claim.completed) continue;

    const bought = await buyEasyPostTestLabel({ shipment_id: shipment.provider_shipment_id, rate_id: shipment.provider_rate_id }, {
      mode: env.EASYPOST_MODE,
      apiKey: env.EASYPOST_API_KEY,
    });
    const now = new Date().toISOString();
    if (!bought.ok) {
      await db.prepare(`UPDATE label_purchase_attempts SET status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'CLAIMED'`).bind(now, claim.id).run();
      return { ok: false, status: 502, error: bought.error };
    }

    await db.batch([
      db.prepare(`
        UPDATE shipments
        SET tracking_number = ?, label_url = ?, status = 'LABEL_CREATED', updated_at = ?
        WHERE id = ? AND order_id = ? AND provider_shipment_id = ? AND provider_rate_id = ? AND status = 'PENDING'
      `).bind(bought.tracking_number, bought.label_url, now, shipment.id, orderId, shipment.provider_shipment_id, shipment.provider_rate_id),
      db.prepare(`UPDATE label_purchase_attempts SET status = 'COMPLETED', updated_at = ? WHERE id = ? AND status = 'CLAIMED'`).bind(now, claim.id),
    ]);
  }

  const finalShipments = await loadShipments(db, orderId);
  if (finalShipments.every(row => row.status === 'LABEL_CREATED' && row.tracking_number && row.label_url)) {
    const now = new Date().toISOString();
    await db.prepare(`UPDATE orders SET order_status = 'READY_TO_SHIP', updated_at = ? WHERE id = ? AND payment_status = 'PAID' AND order_status = 'PAID'`).bind(now, orderId).run();
  }
  return { ok: true, detail: await orderDetail(db, orderId) };
}

async function markShipped(db, orderId) {
  const order = await loadOrder(db, orderId);
  if (!order) return { ok: false, status: 404, error: 'order_not_found' };
  if (order.payment_status !== 'PAID' || order.order_status !== 'READY_TO_SHIP') return { ok: false, status: 409, error: 'order_not_ready_to_ship' };
  const shipments = await loadShipments(db, orderId);
  if (!shipments.length || shipments.some(row => row.status !== 'LABEL_CREATED' || !row.tracking_number || !row.label_url)) {
    return { ok: false, status: 409, error: 'labels_incomplete' };
  }
  const now = new Date().toISOString();
  await db.prepare(`UPDATE orders SET order_status = 'SHIPPED', updated_at = ? WHERE id = ? AND payment_status = 'PAID' AND order_status = 'READY_TO_SHIP'`).bind(now, orderId).run();
  return { ok: true, detail: await orderDetail(db, orderId) };
}

export async function handleAdminOrders(request, env) {
  const db = env?.MAYIONICS_DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);
  const url = new URL(request.url);

  if (url.pathname === '/api/admin/orders' && request.method === 'GET') return json({ orders: await listOrders(db) });

  const labelMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/shipping-label$/);
  if (labelMatch && request.method === 'POST') {
    const result = await buyLabels(db, decodeURIComponent(labelMatch[1]), env);
    return result.ok ? json(result.detail) : json({ error: result.error }, result.status);
  }

  const shippedMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/mark-shipped$/);
  if (shippedMatch && request.method === 'POST') {
    const result = await markShipped(db, decodeURIComponent(shippedMatch[1]));
    return result.ok ? json(result.detail) : json({ error: result.error }, result.status);
  }

  const detailMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (detailMatch && request.method === 'GET') {
    const detail = await orderDetail(db, decodeURIComponent(detailMatch[1]));
    return detail ? json(detail) : json({ error: 'order_not_found' }, 404);
  }

  return json({ error: 'not_found' }, 404);
}
