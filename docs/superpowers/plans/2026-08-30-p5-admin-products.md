# MayIonics P5 Admin Authentication + Product Management Plan

## Goal
Implement the server-side security and product-management code required for a private MayIonics admin area, without deploying Cloudflare resources or weakening the current GitHub Pages development boundary.

## Security Design

P5 will use Cloudflare Access as the identity gateway when deployment occurs, and the Worker will independently verify the forwarded Access JWT before executing any admin API operation.

Worker authentication requirements:

- `Cf-Access-Jwt-Assertion` must be present.
- JWT algorithm must be `RS256`.
- Signature must verify against the configured Cloudflare Access certificate/JWK set.
- `iss` must equal the configured Access team domain.
- `aud` must contain the configured Access application audience.
- token must be within `exp` / `nbf` time bounds.
- authenticated email must be in `ADMIN_EMAILS`.

Required runtime configuration values are environment bindings/secrets, never repository values:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `ADMIN_EMAILS`
- D1 binding `MAYIONICS_DB`

Direct Worker bypass must not be enabled for production admin routes; deployment must place every admin API entrypoint behind the same Access boundary.

## Product Management

P5 implements authenticated admin API responsibilities:

- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `POST /api/admin/products/:id/hide`

The API supports create, read, update, and hide. It does not permanently delete products.

Product inputs use integer cents, explicit condition/status values, quantity constraints, package dimensions/weight, featured state, and JSON image-reference metadata compatible with the P2 schema.

## Admin UI

An unlinked `/admin/` interface will be added as the future management client. On the current `github.io` development host it must display an unavailable state and must not perform admin API writes. This prevents a misleading partially functional admin experience before Cloudflare Access/Worker routing exists.

The UI source itself is not treated as a security boundary. Server-side JWT verification remains mandatory.

## Tasks

1. Add failing tests for Access claim policy, cryptographic JWT verification, product validation, no-delete semantics, protected routing, and the GitHub Pages admin lockout.
2. Implement `src/access-auth.js` using Web Crypto and Cloudflare Access JWKs.
3. Implement `src/admin-products.js` with validated D1 product CRUD/hide operations.
4. Implement `src/worker.js` protected admin routing.
5. Add `/admin/index.html` and `/admin/admin.js` with GitHub Pages lockout and API-ready behavior for later deployment.
6. Update project state and README.
7. Run complete CI and D1 migration validation, inspect PR scope, and merge only when green.

## Boundaries

- No Cloudflare Worker or D1 resource is created/deployed in P5 local implementation.
- No Access application/policy is created because no Cloudflare connector is available in this chat.
- No admin credentials, emails, Access audience IDs, team domains, or secrets are committed.
- No Stripe, PayPal, or EasyPost integration.
- No NutriLeaf changes.
