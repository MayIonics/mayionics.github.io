# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P5 implements the local security and product-management backend for the future private admin environment.

The Worker now contains server-side Cloudflare Access JWT verification using RS256, issuer/audience/time validation, and an administrator email allowlist before any `/api/admin/` product route is dispatched. Product administration supports list, create, update, and hide operations against the planned `MAYIONICS_DB` D1 binding; permanent product deletion is intentionally not implemented.

An unlinked `/admin/` client is included for future add/edit/hide workflows. On the current public GitHub Pages host it intentionally disables admin operations because Cloudflare Access, the Worker, and D1 are not deployed there.

The initial D1 schema remains CI-verified but unapplied. No Cloudflare resource, Access policy, credential, secret, Stripe/PayPal setting, EasyPost setting, or NutriLeaf resource is changed by P5.

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
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
