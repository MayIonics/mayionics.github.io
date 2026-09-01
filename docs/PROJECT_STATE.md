# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P13  
Status: dedicated non-production Cloudflare TEST environment bootstrap verified  
Development site: https://mayionics.github.io/  
Next phase: P14 — configure and verify Stripe TEST and PayPal Sandbox checkout paths

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

P12 added seller reviews and pre-launch policy/about content through PR #13.

P13 completed the dedicated non-production Cloudflare environment bootstrap through PRs #14–#19. GitHub Actions run 33343141668 completed successfully against main commit f88abb7aa1a43890660c55419764f3291e4fd026. It confirmed the existing P1–P12 schema in the dedicated TEST D1 database, deployed only `mayionics-api-test`, and passed the bounded Worker health verification. The Worker health endpoint was independently rechecked after the workflow and returned `{"ok":true,"service":"mayionics-api"}`.

## P12 Scope

P12 completes the non-commerce trust and policy layer.

- `reviews.html` shows selected historical eBay seller feedback from the supplied public feedback record.
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

P13 created and verified only the dedicated MayIonics TEST infrastructure:

- Worker: `mayionics-api-test`
- Worker URL: `https://mayionics-api-test.adam-d-may-20.workers.dev`
- D1 database: `mayionics-test`
- D1 binding: `MAYIONICS_DB`

P13 made no Stripe, PayPal, EasyPost, production-commerce, production-Cloudflare, or NutriLeaf change. No provider secret is committed in this repository or exposed to browser code.

EasyPost is temporarily on hold pending separate support resolution for MayIonics API access. Until that is resolved, no EasyPost API request, real label/postage purchase, wallet funding, carrier subscription, production credential, or production-shipping activation is authorized. MayIonics EasyPost configuration must remain separate from NutriLeaf’s future separate EasyPost account.

## Next

P14 is limited to the already-built Stripe TEST and PayPal Sandbox checkout paths. It may configure only their required TEST/Sandbox Worker secrets and webhook settings, then perform controlled end-to-end TEST/Sandbox checkout verification with payment reconciliation. It must not configure or invoke EasyPost, use any Live provider mode, or make any production-commerce or NutriLeaf change.
