# MayIonics Project State

Project: MayIonics  
Repository: MayIonics/mayionics.github.io  
Current phase: P5  
Status: local admin security/product management implemented; verification in progress  
Development site: https://mayionics.github.io/  
Next phase: P6 — Cart + reservations

## Verified Baselines

P1 established and published the GitHub Pages storefront foundation through PR #1.

P2 defined the initial Cloudflare D1 / SQLite commerce schema through PR #2. The append-only migration is verified in CI but has not been applied to a Cloudflare D1 resource.

P3 established the full static customer-facing storefront shell through PR #4.

P4 added tested catalog behavior through PR #5 while deliberately keeping the public product source empty until real MayIonics inventory is intentionally listed.

## P5 Scope

P5 implements the deployable security and product-management code for the future private admin environment without creating Cloudflare resources.

- `src/access-auth.js` verifies `Cf-Access-Jwt-Assertion` using RS256 and the configured Cloudflare Access JWK endpoint.
- JWT policy validates issuer, application audience, `exp` / `nbf`, and an `ADMIN_EMAILS` allowlist.
- `src/admin-products.js` implements authenticated product list/create/update/hide operations against the `MAYIONICS_DB` D1 binding.
- Product input validation enforces integer cents, inventory constraints, allowed condition/status values, image-reference arrays, and positive package measurements.
- Product deletion is intentionally absent; hiding uses the existing `HIDDEN` lifecycle state.
- `src/worker.js` performs Access verification before dispatching any `/api/admin/` handler.
- `/admin/` contains the future management client for add/edit/hide operations.
- The admin client detects the current `github.io` host and disables all admin API operations there because the protected Worker/Access boundary is not deployed yet.
- The public storefront does not link to `/admin/`.

P5 tests include an ephemeral RSA keypair and signed JWT to verify the actual Web Crypto signature-validation path without committing credentials.

## Cloudflare Deployment Boundary

No Cloudflare connector is available in the current ChatGPT environment. P5 therefore does not create a Worker, D1 database, Access application, policy, audience tag, team-domain binding, or admin-email binding.

When deployment is authorized and technically available, every admin entrypoint must remain behind Cloudflare Access and the Worker must continue independently validating the Access JWT. Direct Worker bypass must not expose admin routes.

Required runtime configuration is deliberately absent from the repository:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `ADMIN_EMAILS`
- D1 binding `MAYIONICS_DB`

## Active Boundaries

There is no live admin API, active D1 connection, functional customer cart/reservation system, shipping-rate integration, Stripe, PayPal, live checkout, or production commerce activation.

No provider credentials or secrets belong in the repository or browser code.

MayIonics remains isolated from NutriLeaf. No NutriLeaf repository, deployment, database, payment configuration, secret, or infrastructure is modified by P5.

## Next

After P5 verification and merge, P6 will implement cart state and server-side inventory reservation logic locally against the existing D1 contract. Infrastructure activation remains separately controlled.
