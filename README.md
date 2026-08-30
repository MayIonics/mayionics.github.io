# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P8 adds the server-authoritative Stripe TEST-mode checkout boundary for future deployment.

The Stripe create route accepts reservation identities, requested carrier/service, customer details, and an idempotency key—not browser-calculated monetary totals. The Worker re-reads reservation/product data from `MAYIONICS_DB`, reconstructs item subtotal from D1 integer-cent prices, re-rates shipping through the EasyPost TEST adapter, creates one pending order, snapshots order items and shipping components, and then can create a Stripe PaymentIntent using the authoritative total.

Checkout retries are protected by an append-only `checkout_attempts` ledger. A second database ledger gives each reservation token one unique checkout claim, preventing two different pending orders from racing to use the same reservation. Stripe calls are hard-gated to `STRIPE_MODE=test`, use a deterministic provider idempotency key, and reject live-mode or amount/currency-mismatched responses.

PaymentIntent creation does not mark an order paid. Payment/order success transitions remain deferred to P10 webhook/provider reconciliation.

No Stripe or EasyPost request, provider key, Cloudflare deployment, PayPal operation, or production commerce action is performed by P8.

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
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
