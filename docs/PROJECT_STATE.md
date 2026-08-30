# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P8  
Status: Stripe TEST checkout boundary implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P9 — PayPal checkout

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while keeping public inventory empty until real listings are intentionally created.

P5 added deployable Cloudflare Access JWT verification and D1-backed admin product-management code through PR #6. No Cloudflare resources were deployed.

P6 added the quantity-only browser cart and D1 reservation-capacity safeguards through PR #7.

P7 added the EasyPost TEST-mode shipping-rate boundary and corrected the reservation D1 binding through PR #8.

## P8 Scope

P8 implements server-authoritative Stripe TEST-mode PaymentIntent creation and the supporting pending-order/idempotency lifecycle without executing a provider request.

- `POST /api/payments/stripe/create` accepts an idempotency key, active reservation token(s), requested carrier/service, customer identity, and a U.S. shipping address.
- Browser subtotal, shipping amount, total, generic `amount`, product price, and other untrusted monetary fields are rejected.
- Reservation/product rows are re-read from `MAYIONICS_DB`; reservations must be `ACTIVE`, unexpired, and backed by active products.
- Item subtotal is reconstructed from D1 `price_cents` and reservation quantities.
- Shipping is re-rated through the P7 EasyPost TEST adapter using authoritative product dimensions/weight; the requested carrier/service must still be available in the newly generated server-side rates.
- A pending order snapshots customer address, authoritative totals, item titles/prices, and selected EasyPost shipment/rate components before Stripe provider identity is stored.
- `migrations/0003_checkout_attempts.sql` adds `checkout_attempts` for idempotent replay/conflict protection and `checkout_reservation_claims` so one reservation token cannot be claimed by two different checkout attempts/orders.
- A same-key/same-fingerprint retry reuses the pending order and deterministic Stripe idempotency header; a conflicting replay returns 409.
- Stripe PaymentIntent creation is hard-gated to `STRIPE_MODE=test` before network access.
- Stripe responses must report `livemode=false` and match the authoritative amount and USD currency before provider identity is persisted.
- PaymentIntent creation stores a `PENDING` payment record only; P8 does not mark an order or payment `PAID`.

## Runtime Configuration Boundary

Runtime values remain outside the repository:

- `MAYIONICS_DB` D1 binding
- `EASYPOST_MODE=test`
- `EASYPOST_API_KEY`
- `MAYIONICS_SHIP_FROM_JSON`
- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY`

No secret key, publishable key, customer payment data, or provider credential is committed.

## Reconciliation Boundary

P8 creates pending provider/payment state only. Successful PaymentIntent creation is not proof that customer payment completed. P10 webhook/provider reconciliation remains responsible for authoritative payment success/failure and order lifecycle transitions.

Reservation consumption and product SOLD transitions are also deferred until verified payment reconciliation.

## Verification

P8 tests cover checkout-input trust boundaries, reservation/product subtotal authority, Stripe TEST-mode network gating, provider mode/amount/currency validation, deterministic Stripe idempotency, checkout schema uniqueness, and prevention of premature PAID transitions.

Repository CI applies all migrations and behaviorally verifies both reservation capacity and the unique checkout reservation-claim race guard.

## Active Boundaries

No Stripe or EasyPost provider request is performed in P8. No Worker/D1 deployment, webhook endpoint activation, PayPal operation, production payment, or production commerce setting is created or modified.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, payment configuration, secret, or infrastructure is modified by P8.

## Next

After P8 verification and merge, P9 will implement the PayPal Sandbox checkout boundary using the same authoritative pending-order and reservation-claim principles while preserving Stripe behavior.
