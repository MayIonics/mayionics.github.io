# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P3 establishes the complete static customer-facing storefront shell using HTML, CSS, and vanilla JavaScript. Home, Shop, Categories, Product, Seller Reviews, About, Shipping & Returns, Cart, Checkout, and Order Confirmation are now represented as real navigable pages.

Commerce behavior remains intentionally inactive in P3. Product data will be connected in P4, cart/reservations in P6, shipping rates in P7, Stripe in P8, PayPal in P9, and order reconciliation/webhooks in P10.

The initial D1 schema from P2 remains defined in the repository but is not yet applied to a Cloudflare database.

## Planned architecture

- GitHub Pages storefront
- Cloudflare Worker backend
- Cloudflare D1 data store
- Stripe card payments
- PayPal checkout
- EasyPost rates, labels, and tracking
- Private admin product/order management

## Project documents

- [Version 1 design](docs/superpowers/specs/2026-08-30-mayionics-v1-design.md)
- [P1 implementation plan](docs/superpowers/plans/2026-08-30-p1-github-pages-baseline.md)
- [P2 implementation plan](docs/superpowers/plans/2026-08-30-p2-d1-schema-migrations.md)
- [P3 implementation plan](docs/superpowers/plans/2026-08-30-p3-storefront-shell.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
