# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P9 adds the server-authoritative PayPal Sandbox checkout boundary while preserving the P8 Stripe TEST checkout path.

PayPal authentication and Orders v2 calls are hard-gated to Sandbox mode. PayPal create reuses the same authority model as Stripe: reservation/product data is re-read from `MAYIONICS_DB`, item subtotal comes from D1 integer-cent prices, shipping is re-rated through EasyPost TEST mode, and the provider order uses only the resulting authoritative USD amount. Deterministic `PayPal-Request-Id` values provide provider-side idempotency.

PayPal capture verifies the local order number, exact PayPal order ID, completed capture identity, USD currency, and authoritative amount before storing the capture ID in the local `payments` ledger as `PENDING`. Neither create nor capture marks the local order paid; P10 webhook/provider reconciliation remains authoritative.

Before any MayIonics D1 deployment, the P8 checkout-attempt provider constraint was broadened to allow `STRIPE` or `PAYPAL`. The unique reservation-claim ledger remains provider-neutral and prevents two checkout attempts from claiming the same reservation.

No PayPal, Stripe, or EasyPost provider request, provider secret, Cloudflare deployment, live provider URL, or production commerce action is performed by P9.

## Planned architecture

- GitHub Pages storefront
- Cloudflare Worker backend
- Cloudflare D1 data store
- Cloudflare Access-protected admin routes
- Stripe card payments
- PayPal checkout
- EasyPost rates, labels, and tracking
- Private admin product/order management

## Project documents

- [Version 1 design](docs/superpowers/specs/2026-08-30-mayionics-v1-design.md)
- [P1 implementation plan](docs/superpowers/plans/2026-08-30-p1-github-pages-baseline.md)
- [P2 implementation plan](docs/superpowers/plans/2026-08-30-p2-d1-schema-migrations.md)
- [P3 implementation plan](docs/superpowers/plans/2026-08-30-p3-storefront-shell.md)
- [P4 implementation plan](docs/superpowers/plans/2026-08-30-p4-product-catalog.md)
- [P5 implementation plan](docs/superpowers/plans/2026-08-30-p5-admin-products.md)
- [P6 implementation plan](docs/superpowers/plans/2026-08-30-p6-cart-reservations.md)
- [P7 implementation plan](docs/superpowers/plans/2026-08-30-p7-easypost-rates.md)
- [P8 implementation plan](docs/superpowers/plans/2026-08-30-p8-stripe-test-checkout.md)
- [P9 implementation plan](docs/superpowers/plans/2026-08-30-p9-paypal-sandbox-checkout.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
