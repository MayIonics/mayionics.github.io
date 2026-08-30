# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P10  
Status: authenticated Stripe TEST / PayPal Sandbox reconciliation implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P11 — admin orders + EasyPost labels/tracking

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while keeping public inventory empty until real listings are intentionally created.

P5 added deployable Cloudflare Access JWT verification and D1-backed admin product-management code through PR #6. No Cloudflare resources were deployed.

P6 added the quantity-only browser cart and D1 reservation-capacity safeguards through PR #7.

P7 added the EasyPost TEST-mode shipping-rate boundary through PR #8.

P8 added server-authoritative Stripe TEST-mode PaymentIntent creation, checkout replay protection, and unique reservation checkout claims through PR #9.

P9 added server-authoritative PayPal Sandbox order creation/capture while preserving Stripe behavior through PR #10.

## P10 Scope

P10 adds authenticated provider webhook handling and authoritative payment/order/inventory reconciliation.

- `POST /api/webhooks/stripe` requires `STRIPE_MODE=test` and verifies the raw request body against `Stripe-Signature` using the configured endpoint secret and a bounded timestamp tolerance.
- Stripe events must report `livemode=false`; only supported PaymentIntent success/failure events are normalized.
- `POST /api/webhooks/paypal` requires `PAYPAL_MODE=sandbox` and verifies webhook authenticity through PayPal's Sandbox webhook-signature verification endpoint.
- PayPal verification requires the configured Sandbox client credentials and webhook ID; no live PayPal API base exists in the P10 runtime.
- Supported PayPal capture events normalize the provider capture identity, exact USD amount, and outcome.
- `migrations/0004_webhook_events.sql` adds a provider event ledger with unique `(provider, provider_event_id)` replay protection plus a product-quantity underflow guard.
- Reconciliation loads the existing provider-neutral payment ledger by exact provider/payment identity and checks the authoritative stored amount/order total before any state transition.
- On verified success, one D1 batch records the event, decrements inventory, marks zero-quantity products `SOLD`, consumes the order's reservations, moves the payment to `SUCCEEDED`, and moves the order to `PAID`.
- A later authenticated success event for an already-paid matching payment/order is recorded as an idempotent no-op and cannot decrement inventory again.
- On supported failure, one D1 batch records the event, changes the matching pending payment to `FAILED`, and changes the pending order payment state to `FAILED` / order state to `CANCELLED`; inventory is not decremented.
- Provider event replay with conflicting payment identity/outcome is rejected.
- Provider identity, Stripe order metadata, amount, currency, unsupported event type, and state conflicts are rejected before commerce state changes.

## Runtime Configuration Boundary

Runtime values remain outside the repository:

- `MAYIONICS_DB`
- `EASYPOST_MODE=test`
- `EASYPOST_API_KEY`
- `MAYIONICS_SHIP_FROM_JSON`
- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_MODE=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

No provider credential, endpoint secret, customer payment credential, or production secret is committed.

## API / Webhook Race Boundary

Provider success can race local persistence. If an authenticated webhook arrives before the matching local `payments` row exists, P10 returns a non-success reconciliation response and does not mutate inventory/order state; provider retry can reconcile after the pending payment identity is persisted. Once reconciled, duplicate success is idempotent.

## Active Boundaries

No Stripe, PayPal, or EasyPost provider request was executed during P10 repository implementation/tests. PayPal signature-verification network behavior is exercised only through test doubles.

No Worker/D1 deployment, webhook registration, secret configuration, production payment, real postage, or production commerce setting is created or modified.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, provider configuration, secret, or infrastructure is modified by P10.

## Next

After P10 verification and merge, P11 will implement Access-protected admin order views plus EasyPost TEST label/tracking fulfillment code. Real postage purchase remains prohibited until separately authorized.
