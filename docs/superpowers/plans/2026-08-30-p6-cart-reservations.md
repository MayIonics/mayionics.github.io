# MayIonics P6 Cart + Reservations Plan

## Goal
Implement customer cart state and the server-side inventory reservation layer required to protect limited inventory, without trusting browser price/availability data or deploying Cloudflare resources.

## Cart Design

The browser cart stores only:

- `product_id`
- `quantity`

It does not persist product price, checkout total, shipping amount, payment state, or authoritative availability.

The cart uses local storage under a versioned MayIonics key. Product titles/prices/images are resolved from the current catalog for display only. Later checkout code will re-read all authoritative values from D1.

## Reservation Design

P6 adds an append-only reservation-safety migration with database triggers that reject an `ACTIVE` reservation if the requested quantity exceeds currently unexpired available stock.

The Worker adds:

- `POST /api/reservations`
- `POST /api/reservations/:token/release`

Reservation tokens are random bearer-capability identifiers. Creation validates product identity and requested integer quantity, uses a bounded reservation TTL, expires stale reservations, and inserts the new reservation through the D1 transaction path.

The database trigger remains the final capacity guard so concurrent requests cannot both reserve more inventory than exists.

P6 does not consume reservations into paid orders; that occurs in later checkout/reconciliation phases.

## Tasks

1. Add failing unit/structural tests for cart normalization, add/update/remove/count behavior, no browser price persistence, reservation validation, public reservation routing, and capacity-guard migration markers.
2. Add `migrations/0002_reservation_capacity_guards.sql` with insert/update capacity triggers.
3. Update CI to apply every migration in order and execute reservation-capacity behavioral SQL checks.
4. Add `assets/js/cart-core.js`, update shared cart-count/add behavior, and add a cart-page renderer.
5. Add an Add to Cart control to purchasable product detail rendering.
6. Add `src/reservations.js` and protected database reservation/release logic; route public reservation endpoints through `src/worker.js` without admin authentication.
7. Update Cart page from P3 placeholder to real local cart UI while leaving checkout inactive.
8. Update project documentation, run full CI, inspect PR scope, and merge only when green.

## Boundaries

- No price or total from local storage is trusted by server code.
- No D1/Worker deployment in this local phase.
- No shipping-rate request.
- No Stripe or PayPal integration.
- No reservation is treated as payment.
- No NutriLeaf changes.
