# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P4 adds the first real product-catalog behavior to the storefront. Home, Shop, and Product pages now share a tested catalog model for product validation, price and condition formatting, availability filtering, sorting, filters, featured/new-arrival rendering, and slug-based product detail lookup.

The public product source intentionally begins empty. Test fixtures verify product behavior without publishing fake items for sale. Real inventory will be added through the product-management path rather than by presenting demo listings as live products.

The initial D1 schema from P2 remains defined and CI-verified but has not yet been applied to a Cloudflare database. The P4 browser catalog is a development source only; a later Worker/D1 implementation will remain authoritative for price, inventory, checkout, shipping, and payment decisions.

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
- [P4 implementation plan](docs/superpowers/plans/2026-08-30-p4-product-catalog.md)
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
