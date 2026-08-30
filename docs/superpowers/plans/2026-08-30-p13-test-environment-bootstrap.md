# P13 TEST/Sandbox Environment Bootstrap Plan

## Goal

Prepare and verify an idempotent GitHub Actions bootstrap for a dedicated non-production MayIonics Cloudflare Worker and D1 database, stopping before any provider credential or webhook configuration is required.

## Non-production resources

- Worker: `mayionics-api-test`
- D1 database: `mayionics-test`
- D1 binding: `MAYIONICS_DB`
- EasyPost mode variable: `test`
- Stripe mode variable: `test`
- PayPal mode variable: `sandbox`

## Bootstrap workflow

A manually triggered GitHub Actions workflow will:

1. Require `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as encrypted GitHub Actions secrets.
2. Verify the token can access the selected Cloudflare account.
3. Find the existing `mayionics-test` D1 database or create it if absent.
4. Generate a temporary Wrangler configuration containing only non-secret mode variables and the discovered D1 database ID.
5. Apply all repository migrations to the remote TEST D1 database in filename order with `--remote --yes`.
6. Deploy `src/worker.js` as `mayionics-api-test` on workers.dev with `--keep-vars`.
7. Query the Worker health endpoint and fail the workflow if it does not return HTTP 200.
8. Query D1 table names and verify the expected P1-P12 schema exists.

## Safety boundaries

- `workflow_dispatch` only; no automatic deployment on push or PR.
- No Stripe, PayPal, or EasyPost API request.
- No payment, label, or postage action.
- No provider secret is stored in the repository.
- No Live provider mode.
- No production MayIonics Worker/database.
- No NutriLeaf resource access.
- Cloudflare credentials must be narrowly scoped to the MayIonics account with Workers Scripts Edit and D1 Edit permissions.

## Next gate

After this bootstrap succeeds, P13 requires provider TEST/Sandbox credentials and webhook endpoint configuration. Those credentials must be configured as encrypted Worker secrets, never pasted into repository files or browser code.
