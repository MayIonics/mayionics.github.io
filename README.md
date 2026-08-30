# MayIonics

MayIonics is an independent online marketplace for quality new, open-box, and pre-owned items, with secure checkout and reliable shipping.

Development site: https://mayionics.github.io/

## Current phase

P7 adds the server-side EasyPost TEST-mode shipping-rate boundary for future deployment.

Shipping requests accept quantity-only cart items and a U.S. destination address. The Worker re-reads active product inventory and package measurements from the planned `MAYIONICS_DB` binding, builds conservative per-unit parcels, and can create EasyPost Shipment rating requests only when the runtime is explicitly configured for TEST mode. Provider rate strings are normalized to integer cents and compatible multi-parcel carrier/service options are combined without trusting browser-supplied shipping data.

The EasyPost adapter refuses non-test configuration before network access and rejects non-test provider Shipment responses. No EasyPost request, label, postage purchase, tracker, API key, or ship-from address is included in the repository or performed during P7.

P7 also corrects the P6 reservation handler to use the established `MAYIONICS_DB` D1 binding consistently with the P5 admin backend.

The Worker/D1 implementation remains repository-only. No Stripe, PayPal, EasyPost, Cloudflare resource, credential, secret, or NutriLeaf resource is changed by P7.

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
- [D1 schema specification](docs/SCHEMA_SPEC.md)
- [Current project state](docs/PROJECT_STATE.md)

MayIonics is maintained separately from NutriLeaf. Provider secrets and production credentials must never be committed to this repository or exposed in browser code.
