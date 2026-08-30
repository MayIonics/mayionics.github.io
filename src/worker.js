import { verifyAccessJwt } from './access-auth.js';
import { handleAdminProducts } from './admin-products.js';
import { handleReservations } from './reservations.js';
import { handleShippingRates } from './shipping-rates.js';
import { handleStripeCheckout } from './stripe-checkout.js';
import { handlePayPalCheckout } from './paypal-checkout.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/payments/paypal/create' || url.pathname === '/api/payments/paypal/capture') {
    return handlePayPalCheckout(request, env);
  }

  if (url.pathname === '/api/payments/stripe/create') {
    return handleStripeCheckout(request, env);
  }

  if (url.pathname === '/api/shipping/rates') {
    return handleShippingRates(request, env);
  }

  if (url.pathname.startsWith('/api/reservations')) {
    return handleReservations(request, env);
  }

  if (url.pathname.startsWith('/api/admin/')) {
    const auth = await verifyAccessJwt(request, env);
    if (!auth.ok) return json({ error: 'admin_unauthorized', reason: auth.reason }, auth.status);
    if (url.pathname.startsWith('/api/admin/products')) return handleAdminProducts(request, env);
    return json({ error: 'not_found' }, 404);
  }

  if (url.pathname === '/health' && request.method === 'GET') {
    return json({ ok: true, service: 'mayionics-api' });
  }

  return json({ error: 'not_found' }, 404);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
