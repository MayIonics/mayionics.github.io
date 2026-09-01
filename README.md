# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P13 has completed the dedicated non-production Cloudflare bootstrap. The TEST Worker `mayionics-api-test` and TEST D1 database `mayionics-test` were verified by the manual P13 GitHub Actions workflow: the existing P1–P12 schema was confirmed, only the dedicated TEST Worker was deployed, and the Worker health endpoint returned the expected response.

P12’s storefront trust/content layer remains in place. The Seller Reviews page presents selected historical eBay seller feedback, clearly identified as prior eBay feedback rather than MayIonics purchase reviews, and links to the public eBay profile for independent verification. NutriLeaf/Etsy product reviews are not reused for MayIonics.

The About, Shipping & Returns, Privacy, and Terms pages contain pre-launch Version 1 policy content. These drafts require a final P14 launch review before production checkout is enabled.

P14 will configure and verify only Stripe TEST and PayPal Sandbox checkout paths. EasyPost remains blocked pending separate API-access support resolution; no EasyPost request, label, postage, wallet funding, carrier subscription, or production shipping action is part of P14.

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
- [P13 implementation plan](docs/superpowers/plans/2026-08-30-p13-test-environment-bootstrap.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
