-- MayIonics P10 authenticated provider webhook ledger
-- Append-only migration for Cloudflare D1 / SQLite.

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('STRIPE', 'PAYPAL')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED', 'FAILED')),
  payload_hash TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('APPLIED', 'IDEMPOTENT')),
  processed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_payment
  ON webhook_events(provider, provider_payment_id, processed_at DESC);

CREATE TRIGGER IF NOT EXISTS products_quantity_nonnegative
BEFORE UPDATE OF quantity ON products
FOR EACH ROW
WHEN NEW.quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'product_quantity_underflow');
END;
