# MayIonics P9 PayPal Sandbox Checkout Plan

## Goal
Implement server-authoritative PayPal Sandbox order creation and capture boundaries while preserving P8 Stripe behavior. No PayPal, EasyPost, Stripe, or Cloudflare provider/resource action is executed in this phase.

## Authority Model

P9 reuses the same trust boundary as P8:

- the browser supplies a client idempotency key,
- active reservation token(s),
- requested shipping carrier/service,
- customer identity and U.S. shipping address.

The Worker re-reads reservation/product data from `MAYIONICS_DB`, reconstructs item subtotal from D1 prices, re-rates shipping through EasyPost Sandbox/TEST configuration, selects the requested carrier/service from fresh server-side quotes, and computes the authoritative total.

Browser-supplied subtotal, shipping amount, total, generic amount, product price, weight, dimensions, payment status, or provider identity is never trusted.

## PayPal Sandbox Authentication

Runtime configuration remains outside the repository:

- `PAYPAL_MODE=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

`getPayPalAccessToken` is hard-gated to Sandbox mode before network access and uses only:

`https://api-m.sandbox.paypal.com/v1/oauth2/token`

with HTTP Basic authentication and `grant_type=client_credentials`.

No live PayPal base URL is included in runtime code.

## PayPal Order Creation

`POST /api/payments/paypal/create`

The Worker creates/reuses one pending PayPal checkout attempt/order using the same replay and reservation-claim principles as Stripe.

PayPal create uses:

`POST https://api-m.sandbox.paypal.com/v2/checkout/orders`

with:

- `intent: CAPTURE`,
- deterministic `PayPal-Request-Id`,
- one purchase unit tied to local order ID/number,
- authoritative USD total,
- authoritative item subtotal and shipping breakdown.

The provider response must contain a PayPal order ID and a non-live Sandbox-compatible order state. When amount details are returned, they must exactly match the local authoritative total.

`checkout_attempts.provider_payment_id` stores the PayPal order ID.

## PayPal Capture

`POST /api/payments/paypal/capture`

Input identifies the local order number and PayPal order ID. The Worker verifies that the local pending PayPal checkout attempt owns that exact provider order identity before capture.

Capture uses:

`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/{paypal_order_id}/capture`

with a deterministic `PayPal-Request-Id` distinct from create.

The response must preserve the requested PayPal order ID and contain a completed capture with:

- a provider capture ID,
- `status: COMPLETED`,
- `currency_code: USD`,
- amount exactly equal to the local authoritative order total.

The capture ID is stored in the provider-neutral `payments` ledger as `PENDING`. P9 does not mark the local payment/order `PAID`; P10 webhook/provider reconciliation remains authoritative.

## Pre-deployment Schema Adjustment

P8 migration `0003_checkout_attempts.sql` currently constrains `checkout_attempts.provider` to `STRIPE`. Since no MayIonics D1 migration has been applied to any Cloudflare database, P9 broadens that not-yet-deployed constraint to:

`provider IN ('STRIPE', 'PAYPAL')`

No already-deployed migration history is rewritten because no such history exists yet. `checkout_reservation_claims` is already provider-neutral.

## Tests

- PayPal integer-cent values format exactly as decimal USD strings.
- OAuth refuses non-Sandbox mode before network access.
- OAuth request uses Sandbox endpoint, Basic auth, and client credentials grant.
- Create order uses Sandbox endpoint, CAPTURE intent, authoritative amount breakdown, and deterministic request ID.
- Create response amount/identity validation rejects mismatches.
- Capture uses the Sandbox capture endpoint and deterministic request ID.
- Capture rejects provider identity, status, currency, or amount mismatches.
- Migration 0003 allows both STRIPE and PAYPAL while preserving uniqueness constraints.
- Worker exposes create/capture PayPal routes without weakening admin authentication.
- PayPal checkout code never marks local order/payment PAID.
- Runtime file contains no live PayPal API base URL.

## Boundaries

- No PayPal API request.
- No EasyPost API request.
- No Stripe API request.
- No provider credentials committed.
- No webhook reconciliation yet.
- No Worker/D1 deployment.
- No production commerce activation.
- No NutriLeaf changes.
