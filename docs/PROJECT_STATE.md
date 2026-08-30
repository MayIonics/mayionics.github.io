# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P3  
Status: storefront shell implemented; verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P4 — Product catalog + product pages

## P1 Baseline

P1 established the static GitHub Pages storefront foundation and was merged to `main` through PR #1. GitHub Pages is published from `main` at the repository root.

## P2 Baseline

P2 defined the initial Cloudflare D1 / SQLite commerce schema and was merged to `main` through PR #2. The repository now contains the append-only initial commerce migration, schema specification, and CI verification for structural tests plus SQL syntax.

P2 does not create or modify an actual Cloudflare D1 database. Database resource creation and migration application remain separate controlled infrastructure actions.

## P3 Scope

P3 expands the static storefront into the approved customer-facing shell:

- Home
- Shop
- Categories
- Product
- Seller Reviews
- About
- Shipping & Returns
- Cart
- Checkout
- Order Confirmation

Navigation now routes to real GitHub Pages documents instead of homepage anchors. Shared CSS supports product grids, category tiles, product-detail layout, catalog controls, checkout steps, empty states, policy content, and responsive navigation.

P3 deliberately keeps commerce inactive. Product listings are connected in P4, cart/reservations in P6, shipping rates in P7, Stripe in P8, PayPal in P9, and order reconciliation/webhooks in P10.

## Active Boundaries

There is no active Worker API, D1 database connection, Stripe integration, PayPal integration, EasyPost integration, admin authentication, live checkout, or customer-data collection in P3.

No provider credentials or secrets belong in the repository or browser code.

MayIonics remains isolated from NutriLeaf. P3 does not modify NutriLeaf repositories, deployments, databases, payment configuration, secrets, or other infrastructure.

## Next

After P3 verification and merge, P4 will connect the storefront shell to a product catalog model and real product-page rendering while keeping server authority and payment/shipping integrations inactive.
