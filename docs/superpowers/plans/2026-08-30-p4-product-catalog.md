# MayIonics P4 Product Catalog + Product Pages Plan

## Goal
Connect the static storefront shell to a real, testable product-catalog model without publishing fake inventory or introducing backend/payment/shipping behavior.

## Design

P4 uses an API-ready frontend boundary:

- `assets/js/products.js` exports the current public product collection and begins empty.
- `assets/js/catalog-core.js` contains pure product validation, availability, filtering, sorting, price/condition formatting, and slug lookup logic.
- `assets/js/catalog.js` renders catalog/product UI from the current product collection.
- Product records use the P2 D1 naming convention (`price_cents`, `quantity`, `condition`, `category`, `status`, `featured`, image references).

The local product source is deliberately temporary. A later Worker-backed implementation can replace the source while preserving the page/rendering contract. The browser remains non-authoritative for checkout, price, inventory, shipping, and payment decisions.

## Tasks

1. Add failing unit/structural tests for product validation, price/condition formatting, availability, filters, sort order, slug lookup, empty catalog behavior, and P4 page connection points.
2. Add the pure catalog core and empty public product source.
3. Replace the Shop shell with rendered catalog/filter containers and empty state.
4. Replace the Product shell with slug-driven product rendering and safe unavailable/not-found states.
5. Connect homepage New Arrivals/Featured sections to the same catalog renderer without fake inventory.
6. Make P3 regression assertions phase-safe so they preserve the storefront structure without freezing P3 placeholder text forever.
7. Update project state/README.
8. Run GitHub Actions, inspect scope, merge only when green.

## Boundaries

- Public product data starts empty; no sample item is presented as live inventory.
- No D1 connection or Cloudflare Worker API in P4.
- No functional cart or inventory reservation.
- No shipping-rate requests.
- No Stripe or PayPal integration.
- No admin product editing yet.
- No NutriLeaf changes.
