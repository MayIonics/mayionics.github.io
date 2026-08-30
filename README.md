# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P6 adds a persistent quantity-only browser cart and the server-side reservation safeguards required for limited inventory.

The browser stores only product IDs and quantities. It does not persist authoritative prices, totals, shipping charges, payment state, or inventory decisions. Product pages can add purchasable catalog items to the cart, and the Cart page supports quantity changes and removal while checkout remains intentionally inactive.

The Worker now includes public reservation create/release handlers for the future D1 deployment. A second append-only migration adds database triggers that reject active reservations exceeding currently unexpired product inventory. CI applies all migrations in order and behaviorally verifies oversell protection and capacity restoration after release.

The P5 Cloudflare Access-protected admin implementation remains repository-only. The D1 migrations and Worker are not deployed yet. No Stripe, PayPal, EasyPost, Cloudflare resource, credential, secret, or NutriLeaf resource is changed by P6.

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
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
