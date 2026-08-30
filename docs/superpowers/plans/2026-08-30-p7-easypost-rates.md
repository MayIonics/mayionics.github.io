# MayIonics P7 EasyPost Shipping Rates Plan

## Goal
Implement the server-side shipping-rate boundary for EasyPost TEST mode without making a provider request, exposing an API key, buying postage, or deploying Cloudflare resources.

## Provider Contract

P7 uses EasyPost Shipment creation (`POST /v2/shipments`) for rating. Each request supplies a destination address, configured ship-from address, and parcel. EasyPost returns rates on the created Shipment.

Runtime configuration remains outside the repository:

- `EASYPOST_API_KEY`
- `EASYPOST_MODE=test`
- `MAYIONICS_SHIP_FROM_JSON`
- D1 binding `MAYIONICS_DB`

The implementation refuses to make a provider request unless `EASYPOST_MODE` is exactly `test`. It also rejects provider Shipment responses whose `mode` is not `test`.

## Parcel Strategy

P7 deliberately does not invent a multi-item packing algorithm. Each cart unit is rated as its own parcel using that product's stored `weight_oz`, `length_in`, `width_in`, and `height_in` values. Compatible carrier/service rates are combined across parcel responses for display.

This conservative design may cost more than optimized packing, but it avoids understating dimensional shipping costs and preserves each provider shipment/rate component for later label purchase.

## Public API

`POST /api/shipping/rates`

Input:

- `items`: product ID + integer quantity only
- `to_address`: U.S. destination address fields

Server behavior:

1. Validate request shape and cap total parcel units.
2. Re-read every product from D1; do not trust browser title, price, dimensions, weight, or availability.
3. Require active products and complete positive package measurements.
4. Build one EasyPost Shipment request per cart unit.
5. Authenticate only server-side using the runtime EasyPost key.
6. Require every provider Shipment to report `mode: test`.
7. Normalize provider rates to integer cents.
8. Combine only matching carrier/service/currency choices present for every parcel.
9. Return quote components needed for later selected-rate persistence and label purchase.

## Corrective P6 Item

P7 first adds a regression test and narrow correction so `src/reservations.js` uses the established `MAYIONICS_DB` binding instead of `env.DB`.

## Tests

- Shipping request validation rejects malformed/unsupported destinations and excessive parcel counts.
- Parcel construction uses D1 product measurements rather than browser fields.
- Money conversion is exact for provider decimal rate strings.
- Combined quotes include only carrier/service combinations available for every parcel.
- EasyPost adapter refuses non-test mode before network access.
- EasyPost adapter rejects a production-mode provider response.
- Worker exposes `/api/shipping/rates` publicly without weakening admin authentication.
- Reservation handler consistently uses `MAYIONICS_DB`.
- No provider key value or production EasyPost credential is committed.

## Boundaries

- No EasyPost API call is executed in this phase.
- No label or postage purchase.
- No tracking activation.
- No Stripe or PayPal integration.
- No Worker/D1 deployment.
- No NutriLeaf changes.
