# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P12  
Status: seller reviews and pre-launch policy/about content implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P13 — complete TEST/Sandbox checkout verification

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while keeping public inventory empty until real listings are intentionally created.

P5 added deployable Cloudflare Access JWT verification and D1-backed admin product-management code through PR #6. No Cloudflare resources were deployed.

P6 added the quantity-only browser cart and D1 reservation-capacity safeguards through PR #7.

P7 added the EasyPost TEST-mode shipping-rate boundary through PR #8.

P8 added server-authoritative Stripe TEST-mode PaymentIntent creation, checkout replay protection, and unique reservation checkout claims through PR #9.

P9 added server-authoritative PayPal Sandbox order creation/capture while preserving Stripe behavior through PR #10.

P10 added authenticated Stripe TEST / PayPal Sandbox webhook reconciliation, provider-event replay protection, authoritative payment/order transitions, reservation consumption, and inventory decrement through PR #11.

P11 added Access-protected admin order views plus TEST-only EasyPost label/tracking fulfillment through PR #12.

## P12 Scope

P12 completes the non-commerce trust and policy layer.

- `reviews.html` now shows selected historical eBay seller feedback from the supplied public feedback record.
- Historical feedback is explicitly labeled as eBay seller feedback and explicitly not presented as MayIonics purchase reviews.
- The page links to the public eBay feedback profile for independent source verification.
- NutriLeaf/Etsy product reviews are not reused for MayIonics.
- `about.html` explains the independent resale model, changing one-off inventory, and condition-transparency expectations.
- `shipping-returns.html` contains a pre-launch U.S. tracked-shipping and returns policy, including a planned 30-day return window subject to final launch review.
- `privacy.html` explains expected order data, provider-handled payment credentials, localStorage cart behavior, service providers, retention/security, and the pre-launch status.
- `terms.html` covers condition, availability, authoritative pricing/payment, shipping, returns, cancellation/errors, and development-site status.
- Homepage footer links directly to the Privacy and Terms pages.

## Policy Boundary

P12 policy pages are pre-launch drafts. They are intended to prevent empty or misleading placeholders during development, but they must receive a final legal/business review in P14 before production checkout is enabled.

No customer contact email or other invented contact detail is published; a dedicated contact method remains a launch-preparation requirement.

## Active Boundaries

P12 changes only storefront content/documentation. No Worker/D1 runtime, migration, Cloudflare setting, provider secret, Stripe/PayPal operation, EasyPost request, real postage purchase, production payment, or production commerce setting is created or modified.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, provider configuration, secret, or infrastructure is modified.

## Next

P13 requires deployment of the already-tested Worker/D1 architecture into a dedicated non-production MayIonics environment plus TEST/Sandbox provider credentials and webhook configuration so end-to-end checkout paths can be exercised. Production/live provider modes remain prohibited.
