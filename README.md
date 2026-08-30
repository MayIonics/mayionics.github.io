# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P10 adds authenticated Stripe TEST and PayPal Sandbox payment reconciliation while preserving the P8/P9 checkout authority model.

Webhook handlers now verify provider authenticity before touching commerce state. Stripe uses the raw request body plus `Stripe-Signature` and a configured TEST webhook secret. PayPal uses the Sandbox webhook-signature verification endpoint with the configured Sandbox webhook ID and client credentials.

Authenticated supported events are normalized to an exact provider payment identity, USD amount, and outcome. The Worker then matches the existing local `payments` row and authoritative order total before applying any transition. Successful reconciliation records the provider event, consumes reservations, decrements inventory, marks zero-quantity products sold, moves the payment to `SUCCEEDED`, and moves the order to `PAID` in one D1 batch. Matching duplicate success events are idempotent and cannot decrement inventory twice.

A new `webhook_events` ledger provides unique provider-event replay protection, and a database trigger blocks negative product quantity. Supported terminal failure events can mark a matching pending payment/order failed/cancelled without decrementing inventory.

No provider request, secret configuration, Cloudflare deployment, live payment, production commerce action, real postage purchase, or NutriLeaf change is performed by P10 repository implementation.

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
- [P10 implementation plan](docs/superpowers/plans/2026-08-30-p10-payment-reconciliation.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
