# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P9  
Status: PayPal Sandbox checkout boundary implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P10 — Order reconciliation + webhooks

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while keeping public inventory empty until real listings are intentionally created.

P5 added deployable Cloudflare Access JWT verification and D1-backed admin product-management code through PR #6. No Cloudflare resources were deployed.

P6 added the quantity-only browser cart and D1 reservation-capacity safeguards through PR #7.

P7 added the EasyPost TEST-mode shipping-rate boundary and corrected the reservation D1 binding through PR #8.

P8 added server-authoritative Stripe TEST-mode PaymentIntent creation, checkout replay protection, and unique reservation checkout claims through PR #9.

## P9 Scope

P9 implements server-authoritative PayPal Sandbox order creation and capture while preserving the Stripe checkout path.

- PayPal OAuth is hard-gated to `PAYPAL_MODE=sandbox` before network access and uses only the Sandbox OAuth endpoint with client-credentials authentication.
- `POST /api/payments/paypal/create` accepts the same trusted identity/selection/customer fields as the Stripe checkout path; browser monetary totals remain rejected.
- Reservation/product rows are re-read from `MAYIONICS_DB`, item subtotal is reconstructed from D1 integer-cent prices, and shipping is re-rated through EasyPost TEST mode before PayPal order creation.
- Pending PayPal orders snapshot authoritative item/shipping/order data and use the same unique reservation claim ledger as Stripe.
- PayPal order creation uses `intent=CAPTURE`, one authoritative USD purchase unit, item/shipping amount breakdown, and deterministic `PayPal-Request-Id`.
- `checkout_attempts.provider_payment_id` stores the PayPal order ID.
- `POST /api/payments/paypal/capture` verifies the local order number and exact PayPal order identity before provider capture.
- Capture responses must contain exactly one completed capture with a provider capture ID, USD currency, and amount exactly equal to the local authoritative order total.
- The PayPal capture ID is inserted into the provider-neutral `payments` ledger as `PENDING`.
- Neither PayPal order creation nor capture marks the local order/payment `PAID`; P10 reconciliation remains authoritative.
- Before any D1 deployment, migration `0003_checkout_attempts.sql` was broadened from Stripe-only to `STRIPE` or `PAYPAL`. No deployed migration history was rewritten.

## Runtime Configuration Boundary

Runtime values remain outside the repository:

- `MAYIONICS_DB`
- `EASYPOST_MODE=test`
- `EASYPOST_API_KEY`
- `MAYIONICS_SHIP_FROM_JSON`
- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY`
- `PAYPAL_MODE=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

No provider credential, client secret, customer payment credential, or live provider URL is committed.

## Reconciliation Boundary

P8/P9 create pending local payment state only. P10 is responsible for validating Stripe/PayPal webhook/provider events, replay protection, provider identity, amount/currency, and safe transitions from PENDING to authoritative paid/failed states.

Reservation consumption and product SOLD transitions remain deferred until verified payment reconciliation.

## Active Boundaries

No PayPal, Stripe, or EasyPost provider request is performed in P9. No Worker/D1 deployment, webhook endpoint activation, production payment, or production commerce setting is created or modified.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, payment configuration, secret, or infrastructure is modified by P9.

## Next

After P9 verification and merge, P10 will add provider webhook/reconciliation safeguards for Stripe and PayPal while preserving the pending-order authority model established in P8/P9.
