-- MayIonics P2 initial commerce schema
-- Append-only migration for Cloudflare D1 / SQLite.

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition TEXT NOT NULL CHECK (condition IN ('NEW', 'OPEN_BOX', 'PRE_OWNED')),
  category TEXT NOT NULL,
  image_data TEXT NOT NULL DEFAULT '[]',
  weight_oz REAL CHECK (weight_oz IS NULL OR weight_oz > 0),
  length_in REAL CHECK (length_in IS NULL OR length_in > 0),
  width_in REAL CHECK (width_in IS NULL OR width_in > 0),
  height_in REAL CHECK (height_in IS NULL OR height_in > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESERVED', 'SOLD', 'HIDDEN')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_status_created
  ON products(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON products(category, status);

CREATE INDEX IF NOT EXISTS idx_products_featured_status
  ON products(featured, status);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'US',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_amount_cents INTEGER NOT NULL CHECK (shipping_amount_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  payment_provider TEXT CHECK (payment_provider IS NULL OR payment_provider IN ('STRIPE', 'PAYPAL')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED')),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN ('PENDING', 'PAID', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_email_created
  ON orders(customer_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(order_status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON order_items(product_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('STRIPE', 'PAYPAL')),
  provider_payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_payment_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payments_order
  ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'EASYPOST' CHECK (provider IN ('EASYPOST')),
  provider_shipment_id TEXT,
  provider_rate_id TEXT,
  carrier TEXT,
  service TEXT,
  shipping_cost_cents INTEGER CHECK (shipping_cost_cents IS NULL OR shipping_cost_cents >= 0),
  tracking_number TEXT,
  label_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'LABEL_CREATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'ERROR')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_shipment_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_shipments_order
  ON shipments(order_id);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking
  ON shipments(tracking_number);

CREATE TABLE IF NOT EXISTS product_reservations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  order_id TEXT,
  reservation_token TEXT NOT NULL UNIQUE,
  reserved_quantity INTEGER NOT NULL DEFAULT 1 CHECK (reserved_quantity > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_reservations_product_status
  ON product_reservations(product_id, status);

CREATE INDEX IF NOT EXISTS idx_product_reservations_expiry
  ON product_reservations(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_product_reservations_order
  ON product_reservations(order_id);
