# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P6  
Status: cart and reservation safeguards implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P7 — EasyPost shipping rates

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while deliberately keeping the public product source empty until real MayIonics inventory is intentionally listed.

P5 added deployable Cloudflare Access JWT verification and D1-backed admin product-management code through PR #6. No Cloudflare resources were deployed.

## P6 Scope

P6 adds customer cart behavior and the server-side inventory reservation safeguards needed for limited-quantity products.

- The browser cart persists only `product_id` and integer `quantity` under versioned local storage key `mayionics.cart.v1`.
- Cart normalization discards browser-supplied titles, prices, totals, availability, and other untrusted fields.
- Product pages expose Add to Cart only for purchasable catalog records.
- The Cart page supports quantity changes and item removal while clearly stating that displayed catalog pricing is not authoritative.
- Checkout remains inactive in P6.
- `POST /api/reservations` creates a bounded 15-minute reservation token through the Worker/D1 path.
- `POST /api/reservations/:token/release` releases an active reservation.
- Reservation creation marks stale active reservations expired before the new write.
- `migrations/0002_reservation_capacity_guards.sql` adds SQLite/D1 insert and update triggers that reject active reservations exceeding currently unexpired inventory capacity.
- The database trigger is the final oversell guard beneath browser and Worker logic.
- CI now applies every migration in order and behaviorally proves that one-unit inventory cannot receive two simultaneous active reservations, then verifies capacity becomes available after release.

## Authority Boundary

Browser cart data is convenience state only. It is never authoritative for price, product status, inventory, totals, shipping, or payment. Later checkout code must re-read products and reservation state from D1 before creating an order or provider payment.

Reservation tokens are bearer-capability identifiers. They must not be logged into public pages or treated as proof of payment. P6 does not consume reservations into paid orders.

## Infrastructure Boundary

The P6 Worker and D1 code remains repository-only. No MayIonics Worker, D1 database, Access application, or production resource is created or modified in this phase.

No Stripe, PayPal, or EasyPost request is performed. No provider credentials or secrets belong in the repository or browser code.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, payment configuration, secret, or infrastructure is modified by P6.

## Next

After P6 verification and merge, P7 will implement EasyPost shipping-rate calculation in TEST mode. Shipping-rate requests will use authoritative product package dimensions/weight and a customer destination; label purchase remains a later fulfillment phase.
