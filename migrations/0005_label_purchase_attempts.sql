-- MayIonics P11 EasyPost TEST label purchase claims
-- Append-only migration for Cloudflare D1 / SQLite.

CREATE TABLE IF NOT EXISTS label_purchase_attempts (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('CLAIMED', 'COMPLETED', 'FAILED')),
  provider_shipment_id TEXT NOT NULL,
  provider_rate_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_label_purchase_attempts_status
  ON label_purchase_attempts(status, updated_at DESC);
