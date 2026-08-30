-- MayIonics P8 checkout idempotency and reservation-claim ledgers
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

CREATE TABLE IF NOT EXISTS checkout_reservation_claims (
  reservation_token TEXT PRIMARY KEY,
  checkout_attempt_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (reservation_token) REFERENCES product_reservations(reservation_token) ON DELETE RESTRICT,
  FOREIGN KEY (checkout_attempt_id) REFERENCES checkout_attempts(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_checkout_reservation_claims_order
  ON checkout_reservation_claims(order_id);
