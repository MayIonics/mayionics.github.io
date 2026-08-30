-- MayIonics P8 checkout idempotency ledger
-- Append-only migration for Cloudflare D1 / SQLite.

CREATE TABLE IF NOT EXISTS checkout_attempts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'STRIPE' CHECK (provider IN ('STRIPE')),
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING', 'PENDING', 'FAILED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_payment_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_status_created
  ON checkout_attempts(status, created_at DESC);
