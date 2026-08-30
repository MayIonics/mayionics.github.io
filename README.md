# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P12 completes the storefront trust/content layer while keeping production commerce inactive.

The Seller Reviews page now presents selected historical eBay seller feedback from the supplied public feedback record, clearly identifies it as prior eBay feedback rather than MayIonics purchase reviews, and links to the public eBay profile for independent verification. NutriLeaf/Etsy product reviews are not reused for MayIonics.

The About page explains the independent resale model and condition-transparency approach. Shipping & Returns, Privacy, and Terms now contain pre-launch Version 1 policy content covering U.S. tracked shipping, planned returns, customer/order data, provider-handled payment credentials, localStorage cart state, product condition/availability, authoritative pricing/payment, and development-site status. These policy drafts require a final P14 launch review before production checkout is enabled.

P12 changes storefront content and documentation only. It does not modify Worker/D1 commerce behavior or perform any Cloudflare, Stripe, PayPal, EasyPost, production-commerce, or NutriLeaf action.

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
- [P12 implementation plan](docs/superpowers/plans/2026-08-30-p12-reviews-policies.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
