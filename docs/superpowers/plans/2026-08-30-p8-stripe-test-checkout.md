# MayIonics P8 Stripe TEST Checkout Plan

## Goal
Implement server-authoritative Stripe TEST-mode PaymentIntent creation and the supporting pending-order/idempotency lifecycle without executing a Stripe or EasyPost provider request and without deploying Cloudflare resources.

## Checkout Authority

The browser must never send a trusted subtotal, shipping amount, or total. P8 accepts:

- a client-generated idempotency key,
- active reservation token(s),
- requested shipping carrier/service,
- customer name/email,
- U.S. shipping address.

The Worker:

1. Re-reads reservation/product data from `MAYIONICS_DB`.
2. Requires every reservation to be ACTIVE and unexpired.
3. Computes item subtotal from D1 product prices.
4. Re-rates authoritative product parcels through the P7 EasyPost TEST adapter.
5. Selects the requested carrier/service from the newly returned server-side quotes.
6. Computes `total_cents = subtotal_cents + shipping_amount_cents`.
7. Creates/reuses one pending order for the checkout idempotency key.
8. Calls Stripe PaymentIntents with the authoritative integer-cent total.
9. Requires Stripe `livemode=false`, matching amount, and `currency=usd` before storing provider identity.

## Idempotency Schema

Add append-only migration `0003_checkout_attempts.sql` with a `checkout_attempts` table containing:

- internal ID,
- unique client idempotency key,
- request fingerprint,
- unique order ID,
- provider fixed to STRIPE for P8,
- optional provider payment ID,
- lifecycle state,
- timestamps.

A replay with the same idempotency key and same fingerprint reuses the existing order and sends the same Stripe idempotency key. A conflicting replay returns 409.

## Stripe Adapter

`createStripePaymentIntent` uses `POST https://api.stripe.com/v1/payment_intents` and form-encoded fields:

- `amount` authoritative integer cents,
- `currency=usd`,
- `automatic_payment_methods[enabled]=true`,
- order metadata,
- optional receipt email.

Runtime configuration:

- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY`

The adapter refuses network access unless mode is `test` and rejects responses with `livemode !== false` or mismatched amount/currency. The secret key is never returned or logged.

## Order Persistence

Before the provider call, P8 creates the PENDING order, item snapshots, selected shipping component rows, checkout attempt, and links active reservations to the order in one D1 batch. Stripe provider identity is written afterward to `payments` and `checkout_attempts`.

P10 remains responsible for webhook-driven final reconciliation. P8 must not mark an order PAID merely because PaymentIntent creation succeeded.

## Tests

- Checkout input rejects browser amount fields and malformed idempotency/reservation/shipping/customer data.
- Authoritative subtotal uses D1 product prices.
- Stripe adapter is hard-gated to TEST mode before network access.
- Stripe response must be non-live and amount/currency-identical.
- PaymentIntent request uses integer cents, metadata, and a deterministic Stripe idempotency header.
- Checkout-attempt migration is append-only and uniquely binds idempotency key/order/provider payment identity.
- Worker exposes Stripe create route without weakening admin authentication.
- Structural checks ensure checkout code does not mark orders PAID.

## Boundaries

- No Stripe API request.
- No EasyPost API request.
- No Stripe secret or publishable key committed.
- No webhook reconciliation yet.
- No PayPal integration.
- No Worker/D1 deployment.
- No production commerce activation.
- No NutriLeaf changes.
