# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P11 adds Access-protected admin order management and TEST-only EasyPost label/tracking fulfillment on top of the P10 reconciliation baseline.

Admin order routes can list orders, show item/payment/shipment detail, create TEST labels for reconciled paid orders, and mark fully labeled orders shipped. The EasyPost buy-label adapter refuses non-test mode, requires the original stored shipment/rate identities, and validates returned shipment identity, tracking code, and label URL before persisting `LABEL_CREATED` state.

A new `label_purchase_attempts` ledger gives each shipment one unique purchase claim and tracks `CLAIMED`, `COMPLETED`, or `FAILED` state to reduce duplicate/concurrent purchases. Once every shipment has a label and tracking number, the order moves from `PAID` to `READY_TO_SHIP`; `mark-shipped` then moves it to `SHIPPED`.

No EasyPost provider request, real postage purchase, Cloudflare deployment, provider secret configuration, live payment, production commerce action, or NutriLeaf change is performed by P11 repository implementation.

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
- [P11 implementation plan](docs/superpowers/plans/2026-08-30-p11-admin-orders-labels.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
