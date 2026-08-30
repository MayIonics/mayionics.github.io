# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P11  
Status: Access-protected admin orders and EasyPost TEST label/tracking workflow implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P12 — seller reviews + policy/about content

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

P10 added authenticated Stripe TEST / PayPal Sandbox webhook reconciliation, provider-event replay protection, authoritative payment/order transitions, reservation consumption, and inventory decrement through PR #11.

## P11 Scope

P11 adds the private admin order/fulfillment workflow while preserving the existing Cloudflare Access boundary.

- `GET /api/admin/orders` lists recent orders.
- `GET /api/admin/orders/:id` returns order, item, payment, and shipment detail.
- `POST /api/admin/orders/:id/shipping-label` is eligible only when `payment_status=PAID` and the order is `PAID` or already `READY_TO_SHIP`.
- Label purchase uses the original authoritative EasyPost `provider_shipment_id` and `provider_rate_id` stored during checkout.
- The EasyPost adapter is hard-gated to `EASYPOST_MODE=test` before network access.
- Provider responses must report `mode=test`, the same shipment identity, a tracking code, and a label URL before local persistence.
- `migrations/0005_label_purchase_attempts.sql` adds one unique label-purchase claim per local shipment to reduce duplicate/concurrent purchases and preserve retry state.
- Successful TEST label metadata updates the shipment to `LABEL_CREATED`; when every shipment for an order has label/tracking data, the order moves from `PAID` to `READY_TO_SHIP`.
- `POST /api/admin/orders/:id/mark-shipped` requires all shipment labels/tracking metadata and moves `READY_TO_SHIP` to `SHIPPED`.
- No public admin route bypass is added; order handlers are reached only after the existing `verifyAccessJwt` check.

## Runtime Configuration Boundary

Runtime values remain outside the repository, including `MAYIONICS_DB`, EasyPost TEST configuration, Stripe TEST configuration, PayPal Sandbox configuration, and Cloudflare Access configuration.

No provider credential, endpoint secret, customer payment credential, or production secret is committed.

## Provider / Fulfillment Boundary

P11 contains a TEST-only EasyPost buy-label adapter, but no EasyPost request or postage purchase was executed during repository implementation/tests. Test doubles validate request construction and provider response checks.

No label purchase is allowed for an unpaid order. Real postage remains prohibited until separately authorized.

## Active Boundaries

No Worker/D1 deployment, Cloudflare Access change, provider secret configuration, Stripe/PayPal operation, EasyPost provider request, real postage purchase, or production commerce action is performed in P11 repository implementation.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, provider configuration, secret, or infrastructure is modified.

## Next

After P11 verification and merge, P12 will complete seller-review presentation plus About, Shipping & Returns, Privacy, and Terms content without activating production commerce.
