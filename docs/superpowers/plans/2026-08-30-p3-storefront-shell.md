# MayIonics P3 Storefront Shell Plan

## Goal
Expand the P1 homepage baseline into the approved static customer-facing storefront shell while preserving GitHub Pages deployment and keeping all commerce behavior inactive.

## Scope
P3 creates navigable static pages for Home, Shop, Categories, Product, Seller Reviews, About, Shipping & Returns, Cart, Checkout, and Order Confirmation. Shared CSS remains product-first, responsive, accessible, and intentionally minimal.

## Tasks

1. Add failing structural tests for the approved page set, shared assets, real navigation links, static/inactive commerce boundaries, and no external API calls.
2. Convert homepage anchor-only navigation to real page routes.
3. Add static shells for all approved customer-facing pages.
4. Extend shared CSS for page headers, filters, product detail layout, panels, empty states, policy content, checkout steps, and responsive navigation.
5. Keep JavaScript limited to presentation-only baseline behavior; no fetch calls, cart persistence, checkout, provider SDKs, or backend integration.
6. Update project state and README for P3.
7. Run GitHub Actions verification, inspect diff scope, open PR, and merge only when green.

## Boundaries

- No product API or database queries.
- No functional cart or inventory reservation logic.
- No shipping rate requests.
- No Stripe or PayPal SDK/API integration.
- No customer data collection in checkout.
- No Cloudflare Worker or D1 resource changes.
- No NutriLeaf changes.
