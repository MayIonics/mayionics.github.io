# P10 Payment Reconciliation and Webhook Plan

## Goal

Add provider-authenticated Stripe TEST and PayPal Sandbox webhook handling that reconciles provider payment events into MayIonics D1 exactly once.

## Scope

1. Add append-only `webhook_events` ledger with unique `(provider, provider_event_id)` replay protection.
2. Verify Stripe webhook signatures locally from the raw request body using the configured TEST endpoint secret.
3. Verify PayPal Sandbox webhook authenticity through the Sandbox verification endpoint adapter; no provider request is executed during repository implementation/tests.
4. Classify only supported payment success/failure events.
5. Require exact provider payment identity, order linkage, USD currency, and authoritative stored amount before state transition.
6. On verified success, transactionally:
   - record webhook event;
   - move payment `PENDING -> SUCCEEDED`;
   - move order payment/order state to `PAID`;
   - consume the order's active reservations;
   - decrement authoritative product quantity by reserved quantity;
   - mark zero-quantity products `SOLD`.
7. On verified terminal failure, transactionally record the event and move matching pending payment/order state to `FAILED` without decrementing inventory.
8. Treat duplicate provider events and already-reconciled matching success/failure as idempotent.
9. Reject provider identity, order, amount, currency, mode/environment, or unsupported-event mismatches.
10. Add `/api/webhooks/stripe` and `/api/webhooks/paypal` Worker routes before public checkout routes.

## Security boundaries

- Stripe requires `STRIPE_MODE=test` and `STRIPE_WEBHOOK_SECRET` at runtime.
- PayPal requires `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` at runtime.
- PayPal verification uses only `https://api-m.sandbox.paypal.com`.
- Raw webhook payloads are not persisted; the ledger stores provider event identity/type, payload hash, result state, and timestamps.
- No secret is committed.
- No provider call is performed during local/repository implementation.
- No Cloudflare/D1 deployment or production activation occurs in P10 implementation.

## TDD verification

RED first for missing reconciliation module/migration/routes. GREEN must cover Stripe signature validation, timestamp tolerance, PayPal Sandbox verification request construction, event classification, amount/currency/provider identity extraction, replay schema uniqueness, and no success transition from unverified/unsupported events. CI must apply all migrations and behaviorally verify duplicate webhook identity is rejected.
