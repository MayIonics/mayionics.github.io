# MayIonics Version 1 Design

## Purpose

MayIonics is a clean, minimal independent online marketplace for quality new, open-box, and pre-owned items. The goal of Version 1 is to provide a straightforward storefront where products can be listed, purchased securely, shipped with tracking, and managed through a private admin area without adding unnecessary marketplace complexity.

## Version 1 Scope

MayIonics Version 1 includes:

- GitHub Pages storefront during development.
- Clean, product-first marketplace visual design with minimal decoration.
- Home, Shop, Categories, Product, Seller Reviews, About, Shipping & Returns, Cart, Checkout, and Order Confirmation pages.
- Responsive desktop, tablet, and mobile layouts.
- Product cards showing image, title, price, condition, and limited-stock state where applicable.
- Product pages with image gallery, price, condition, description, quantity/status, shipping information, and Add to Cart.
- Guest checkout only; customer accounts are not required.
- Cloudflare Worker backend API.
- Cloudflare D1 for products, orders, order items, payments, shipments, and temporary product reservations.
- Stripe for card payments.
- PayPal for PayPal checkout.
- EasyPost for shipping rates, label creation, and tracking.
- Private admin area for product and order management.
- Product availability and sold-out protection, including temporary reservations for one-of-a-kind inventory.
- Seller Reviews page incorporating historical eBay seller feedback and linking to the public eBay feedback profile for verification.

## Explicitly Out of Scope for Version 1

Version 1 will not include:

- Customer accounts.
- Wishlists.
- Loyalty programs.
- Coupon systems.
- Marketplace synchronization.
- Profit or sourcing-cost tracking.
- Advanced analytics.
- Reviews submitted directly through MayIonics.
- Live Stripe or PayPal commerce during development.
- Production EasyPost postage purchases during development.
- A custom domain during initial development.

## Frontend Architecture

The storefront will use a lightweight static frontend hosted on GitHub Pages during development. The initial implementation will use HTML, CSS, and JavaScript rather than a large client framework.

The frontend will call the backend API for authoritative product, checkout, payment, and shipping operations. The browser will never hold provider secrets or receive direct D1 access.

Customer-facing page structure:

- `/` — Home
- `/shop.html` — Shop/catalog
- `/categories.html` — Categories
- `/product.html` — Product detail
- `/reviews.html` — Seller Reviews
- `/about.html` — About
- `/shipping-returns.html` — Shipping & Returns
- `/cart.html` — Cart
- `/checkout.html` — Checkout
- `/order-confirmation.html` — Order confirmation

The homepage will contain:

1. Compact header with MayIonics branding, navigation, and cart.
2. Small hero area with one short headline and one Shop action.
3. New Arrivals product grid.
4. Shop by Category section.
5. Featured Items product grid.
6. eBay seller reputation/reviews section.
7. Simple trust row for secure payments, tracked shipping, and clearly described condition.
8. Footer containing About, Shipping & Returns, Contact, Privacy, and Terms links.

The shop page will use a compact filter/sort row and a responsive product grid. The product page will prioritize photographs and essential product information over promotional content.

## Visual Direction

MayIonics will use a clean marketplace aesthetic:

- Product-first presentation.
- Neutral backgrounds.
- High-contrast readable text.
- Consistent image aspect ratios.
- Thin borders and restrained hover effects.
- One accent color for actions and links.
- Minimal animation.
- No countdown timers, flashing sale graphics, intrusive popups, or oversized promotional banners.

## Product Model

Each product needs only the commerce and shipping data required to list and fulfill it.

Recommended product fields:

- `id`
- `slug`
- `title`
- `description`
- `price_cents`
- `quantity`
- `condition`
- `category`
- image references/metadata
- `weight_oz`
- `length_in`
- `width_in`
- `height_in`
- `status`
- `featured`
- `created_at`
- `updated_at`

Money is stored as integer cents rather than floating-point currency values.

Initial product status values:

- `ACTIVE`
- `RESERVED`
- `SOLD`
- `HIDDEN`

For one-of-a-kind items, quantity is normally `1`.

## Inventory Reservation

MayIonics must prevent two customers from successfully purchasing the same one-of-a-kind item.

The intended lifecycle is:

`ACTIVE -> RESERVED -> SOLD`

If checkout fails or a temporary reservation expires:

`RESERVED -> ACTIVE`

The backend is authoritative for availability. The frontend may display stock state, but it cannot decide whether an item is available for purchase.

## Database Architecture

The initial D1 model contains six core tables:

- `products`
- `orders`
- `order_items`
- `payments`
- `shipments`
- `product_reservations`

### Orders

Recommended order fields:

- `id`
- `order_number`
- `customer_email`
- `customer_name`
- shipping-address fields
- `subtotal_cents`
- `shipping_amount_cents`
- `total_cents`
- `payment_provider`
- `payment_status`
- `order_status`
- `created_at`
- `updated_at`

Order lifecycle:

`PENDING -> PAID -> READY_TO_SHIP -> SHIPPED -> DELIVERED`

Additional states:

- `CANCELLED`
- `REFUNDED`

### Order Items

Order items preserve the purchased product title and price at the time of purchase so later product edits do not alter historical orders.

Recommended fields:

- `id`
- `order_id`
- `product_id`
- `product_title`
- `quantity`
- `unit_price_cents`
- `line_total_cents`

### Payments

Payments remain provider-neutral internally.

Recommended fields:

- `id`
- `order_id`
- `provider`
- `provider_payment_id`
- `amount_cents`
- `status`
- `created_at`
- `updated_at`

Provider values initially include `STRIPE` and `PAYPAL`.

### Shipments

Recommended fields:

- `id`
- `order_id`
- `provider`
- `carrier`
- `service`
- `shipping_cost_cents`
- `tracking_number`
- label reference/URL metadata
- `status`
- `created_at`
- `updated_at`

## Backend Architecture

The backend will run as a separate Cloudflare Worker named `mayionics-api` when that phase begins. It will be isolated from NutriLeaf infrastructure.

Initial public API shape:

- `GET /api/products`
- `GET /api/products/:slug`
- `GET /api/categories`
- `POST /api/shipping/rates`
- `POST /api/checkout/create`
- `GET /api/orders/:orderNumber/confirmation`

Payment routes:

- `POST /api/payments/stripe/create`
- `POST /api/payments/paypal/create`
- `POST /api/payments/paypal/capture`

Webhook routes:

- `POST /api/webhooks/stripe`
- `POST /api/webhooks/paypal`
- `POST /api/webhooks/easypost`

Exact route naming may be refined during implementation as long as the responsibilities and security boundaries remain unchanged.

## Server Authority

The browser is never authoritative for:

- Product price.
- Product availability.
- Shipping cost.
- Checkout total.
- Payment completion.
- Sold status.

For checkout, the Worker receives product identifiers, reads authoritative product data from D1, verifies availability, calculates totals, validates the selected shipping rate, and creates the provider payment transaction.

## Stripe

Stripe will process card payments in Test mode during development.

The Worker will create and reconcile Stripe payment state. Stripe webhook handling will be idempotent and will reconcile provider state with the internal MayIonics order rather than trusting browser callbacks.

No Stripe secrets will be committed to GitHub or exposed to frontend JavaScript.

## PayPal

PayPal Sandbox will be used during development.

The intended flow is:

1. Internal order is created.
2. PayPal order is created server-side.
3. Customer approves PayPal checkout.
4. Worker captures the approved PayPal order.
5. Internal payment/order state is reconciled.
6. Webhooks provide additional authoritative reconciliation.

PayPal handling will be idempotent and designed defensively against duplicate/replayed requests and concurrent reconciliation races.

## EasyPost

EasyPost Test mode will provide shipping rate discovery during development.

Rate flow:

1. Customer provides shipping destination.
2. Worker retrieves authoritative package weight and dimensions from the product records.
3. Worker provides origin, destination, and parcel data to EasyPost.
4. EasyPost returns available rates.
5. Customer selects a rate.
6. Selected shipping cost becomes part of the authoritative checkout total.

A real shipping label is not purchased before successful payment.

After payment, the private admin order workflow will support buying/creating the shipping label, saving the tracking number, and marking the order shipped. Development must not purchase real postage.

## Admin Area

The private admin area will support:

- Add product.
- Edit product.
- Hide product.
- Upload/reference product photographs.
- Set price, quantity, condition, category, weight, and package dimensions.
- View orders.
- View individual order details.
- Create shipping label after payment.
- Store/view tracking information.
- Mark order shipped.

Initial admin API responsibilities include:

- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `POST /api/admin/products/:id/hide`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `POST /api/admin/orders/:id/shipping-label`
- `POST /api/admin/orders/:id/mark-shipped`

Permanent product deletion is not required in Version 1 because historical orders may reference prior products.

## Admin Authentication

The preferred approach is Cloudflare Access rather than implementing custom password authentication.

The admin area will be private while the public storefront remains publicly accessible. Sensitive admin API routes must verify authorization server-side; hiding the admin HTML alone is not considered security.

## Product Images

D1 will store image references and metadata rather than raw image files.

The initial implementation should keep image storage abstract enough that Cloudflare R2 or Cloudflare Images can be adopted later without redesigning the product model.

## eBay Seller Reviews

MayIonics will include a Seller Reviews page using the historical eBay feedback supplied for the project.

The reviews must be clearly labeled as eBay seller feedback rather than reviews of MayIonics website purchases.

The page should include a prominent link to the public eBay feedback profile for source verification.

The homepage may display a small representative subset of the eBay feedback and provide a `View All eBay Reviews` action leading to the Seller Reviews page.

## Development Environments

Development must use non-production provider environments:

- Stripe Test.
- PayPal Sandbox.
- EasyPost Test.
- Separate development/test D1 resources.

Production activation requires a later explicit approval and is outside the initial P1 baseline.

Provider credentials, keys, tokens, and secrets must never be committed to the repository or exposed to browser code.

## Repository and Deployment Boundaries

Repository:

`MayIonics/mayionics.github.io`

Initial development website target:

`https://mayionics.github.io/`

P1 does not create or modify Cloudflare, Stripe, PayPal, or EasyPost resources.

NutriLeaf repositories, infrastructure, deployments, data, secrets, and provider settings are explicitly outside the MayIonics project and must remain untouched.

## Development Phases

The planned sequence is:

- P1 — Repository + GitHub Pages project baseline.
- P2 — D1 schema + migrations.
- P3 — Storefront shell.
- P4 — Product catalog + product pages.
- P5 — Admin authentication + product management.
- P6 — Cart + reservations.
- P7 — EasyPost rate calculation.
- P8 — Stripe checkout.
- P9 — PayPal checkout.
- P10 — Order reconciliation + webhooks.
- P11 — Admin orders + EasyPost labels/tracking.
- P12 — Seller Reviews + policy/about pages.
- P13 — Complete Test/Sandbox checkout verification.
- P14 — Production preparation.
- P15 — Production launch.

Each phase follows DEFINE -> BUILD -> VERIFY -> CHECKPOINT, with isolated branches and tests appropriate to the phase.

## P1 Success Criteria

P1 is complete when:

- The MayIonics repository is isolated from NutriLeaf.
- A clean GitHub Pages-compatible project skeleton exists.
- The approved architecture is documented in the repository.
- A minimal MayIonics storefront baseline exists without payment, shipping, or backend integration.
- Basic structural/static verification passes.
- No secrets are committed.
- No Cloudflare, Stripe, PayPal, EasyPost, or NutriLeaf resources are changed.
- The resulting branch/PR state is verified before merge or deployment.
