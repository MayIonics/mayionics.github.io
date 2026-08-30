# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P4  
Status: product catalog implemented; verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P5 — Admin authentication + product management

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2. The append-only migration is verified in CI but has not been applied to a Cloudflare D1 resource.

P3 established the full static customer-facing storefront shell through PR #4: Home, Shop, Categories, Product, Seller Reviews, About, Shipping & Returns, Cart, Checkout, and Order Confirmation.

## P4 Scope

P4 adds the first real catalog behavior without publishing fake inventory.

- `assets/js/products.js` is the current public product source and intentionally begins empty.
- `assets/js/catalog-core.js` provides testable product validation, price/condition formatting, public availability filtering, catalog filters, sorting, and slug lookup.
- `assets/js/catalog.js` renders Home, Shop, and Product page catalog views.
- Shop filters become active when real products exist.
- Product pages resolve a product from the `slug` query parameter and safely show unavailable/not-found states.
- Home New Arrivals and Featured Items use the same product source.
- Product records align with the P2 commerce model for price, inventory, condition, category, status, and featured state.

P4 test fixtures validate catalog behavior without appearing on the public website. The public site remains empty until real MayIonics inventory is intentionally added.

## Authority Boundary

The P4 source is a development catalog source, not the final commerce authority. A later Cloudflare Worker/D1 integration will become authoritative for product price, quantity, availability, checkout totals, reservations, shipping, and payment state.

No browser-side product value is trusted for future checkout decisions.

## Active Boundaries

There is no active Cloudflare Worker API or D1 database connection yet. There is no functional cart/reservation system, shipping-rate integration, Stripe, PayPal, admin authentication, live checkout, or production commerce activation.

No provider credentials or secrets belong in the repository or browser code.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, payment configuration, secret, or infrastructure is modified by P4.

## Next

After P4 verification and merge, P5 will establish protected admin access and product-management boundaries. Actual Cloudflare resource creation will remain a separate controlled step when required.
