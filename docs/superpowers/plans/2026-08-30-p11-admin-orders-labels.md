# P11 Admin Orders and EasyPost TEST Labels Plan

## Goal

Add Access-protected admin order views and TEST-only EasyPost label/tracking fulfillment without executing provider requests during repository implementation.

## Scope

1. Add admin order list/detail handlers under `/api/admin/orders`.
2. Add `POST /api/admin/orders/:id/shipping-label` to purchase TEST labels only for paid orders with pending EasyPost shipment/rate identities.
3. Add `POST /api/admin/orders/:id/mark-shipped` only after every shipment has label/tracking metadata.
4. Add an append-only `label_purchase_attempts` ledger with one unique claim per shipment to reduce duplicate/concurrent label purchases.
5. Hard-gate EasyPost buying to `EASYPOST_MODE=test` and validate returned Shipment identity, `mode=test`, tracking code, and label URL before persistence.
6. Update shipment rows to `LABEL_CREATED`; once all labels exist, move the order from `PAID` to `READY_TO_SHIP`.
7. Mark-shipped moves `READY_TO_SHIP` to `SHIPPED`; no provider network action is required for this local transition.
8. Keep all admin routes behind existing Cloudflare Access JWT verification.

## Boundaries

- No real postage purchase.
- No EasyPost provider request during implementation/tests.
- No Cloudflare/D1 deployment or secret configuration.
- No Stripe/PayPal operation.
- No NutriLeaf changes.
