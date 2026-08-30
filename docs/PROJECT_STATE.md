# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P7  
Status: EasyPost TEST-rate boundary implemented; final verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P8 — Stripe checkout

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while deliberately keeping the public product source empty until real MayIonics inventory is intentionally listed.

P5 added deployable Cloudflare Access JWT verification and D1-backed admin product-management code through PR #6. No Cloudflare resources were deployed.

P6 added the quantity-only browser cart and D1 reservation-capacity safeguards through PR #7.

## P7 Scope

P7 implements the server-side EasyPost shipping-rate boundary for future TEST-mode deployment without making an EasyPost request.

- `POST /api/shipping/rates` accepts only quantity-only cart items plus a U.S. destination address.
- Browser-supplied product price, title, weight, dimensions, availability, or shipping values are rejected/not trusted.
- Products and package measurements are re-read from the authoritative `MAYIONICS_DB` binding.
- Requested quantity is checked against active product inventory before rating.
- Every cart unit is conservatively represented as its own parcel; no unverified multi-item packing algorithm is used.
- Parcel weight uses ounces and dimensions use inches, matching the stored MayIonics product model and EasyPost parcel units.
- The EasyPost adapter is hard-gated to `EASYPOST_MODE=test` before network access and rejects provider Shipment responses not marked `mode: test`.
- EasyPost decimal rate strings are normalized to integer cents.
- Multi-parcel choices are combined only when the same carrier, service, and currency is available for every parcel; provider shipment/rate IDs remain attached as quote components.
- A P6 integration correction aligns reservation code with the established D1 binding name `MAYIONICS_DB`.

## Runtime Configuration Boundary

The following runtime values remain outside the repository:

- `EASYPOST_API_KEY`
- `EASYPOST_MODE=test`
- `MAYIONICS_SHIP_FROM_JSON`
- D1 binding `MAYIONICS_DB`

No EasyPost API key or ship-from address is committed. The shipping handler returns configuration errors rather than attempting a request when TEST-mode configuration is incomplete.

## Provider Boundary

P7 contains an EasyPost TEST-mode adapter but no provider request was executed during implementation. No label, postage, tracker, or production EasyPost operation is created.

Shipping-rate results are quotes only. P7 does not persist a selected rate, create an order, activate checkout, or purchase a label.

## Active Boundaries

The Worker and D1 code remain repository-only. No MayIonics Worker, D1 database, Cloudflare Access application, EasyPost account setting, Stripe setting, PayPal setting, or production resource is created or modified by P7.

No provider credentials or secrets belong in the repository or browser code.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, payment configuration, secret, or infrastructure is modified by P7.

## Next

After P7 verification and merge, P8 will implement Stripe TEST-mode checkout locally. It must re-read authoritative product/reservation/shipping values before creating a provider payment and will remain unable to perform a Stripe request until TEST credentials and deployment infrastructure are explicitly configured.
