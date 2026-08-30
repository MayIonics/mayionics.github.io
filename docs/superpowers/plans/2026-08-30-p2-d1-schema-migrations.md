# MayIonics P2 D1 Schema + Migrations Plan

## Goal
Define the first MayIonics commerce schema as an append-only Cloudflare D1 migration, verify it structurally, and document the database contract without creating production resources.

## Scope
P2 adds the database contract only. It does not implement Worker routes, storefront API calls, payment provider calls, shipping provider calls, admin authentication, or production deployment.

## Schema
Migration `migrations/0001_initial_commerce.sql` will create:

- `products`
- `orders`
- `order_items`
- `payments`
- `shipments`
- `product_reservations`

Money is stored as integer cents. Timestamps are stored as ISO-8601 text. Foreign-key relationships are explicit. Lifecycle values use CHECK constraints. Provider identities use uniqueness constraints where replay/reconciliation safety requires them.

## Tasks

1. Add failing structural tests for the six-table contract, required fields, lifecycle constraints, indexes, provider identity uniqueness, reservation expiry, and non-destructive migration behavior.
2. Add `migrations/0001_initial_commerce.sql` with the minimum schema required by the approved V1 architecture.
3. Add `docs/SCHEMA_SPEC.md` documenting responsibilities, invariants, and later-phase assumptions.
4. Update `docs/PROJECT_STATE.md` to record the P2 checkpoint and P3 next phase.
5. Run the complete Node test suite and inspect the branch diff for unrelated changes or obvious credential material.
6. Open a PR to `main`, verify its changed-file scope, and merge only if verification is green.

## Safety Boundaries

- No production Cloudflare D1 database is created or modified in P2.
- No Stripe, PayPal, or EasyPost calls or credentials are introduced.
- No NutriLeaf repository or infrastructure is modified.
- No destructive DROP statements are permitted in the initial migration.
- Later Worker code remains authoritative for pricing, inventory, shipping, and payment state.
