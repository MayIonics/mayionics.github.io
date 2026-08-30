# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P2  
Status: schema implemented; verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P3 — Storefront shell

## P1 Baseline

P1 established the static GitHub Pages storefront foundation and was merged to `main` through PR #1. GitHub Pages is published from `main` at the repository root.

## P2 Scope

P2 defines the initial Cloudflare D1 / SQLite commerce schema as an append-only migration and documents the database contract.

P2 includes the six approved commerce tables:

- `products`
- `orders`
- `order_items`
- `payments`
- `shipments`
- `product_reservations`

The schema uses integer cents for money, explicit lifecycle constraints, foreign-key relationships, provider-identity uniqueness, reservation expiry data, and practical lookup indexes.

P2 does not create or modify an actual Cloudflare D1 database. Database resource creation and migration application remain separate controlled infrastructure actions.

## Active Boundaries

There is still no active backend Worker integration, Stripe integration, PayPal integration, EasyPost integration, admin authentication, or live checkout in this repository phase.

No provider credentials or secrets belong in the repository or browser code.

MayIonics remains isolated from NutriLeaf. P2 does not modify NutriLeaf repositories, deployments, databases, payment configuration, secrets, or other infrastructure.

## Next

After P2 verification and merge, P3 will expand the current homepage baseline into the customer-facing storefront shell while preserving the static GitHub Pages development deployment. Backend resource creation will remain separately gated to the phase where it is actually required.
