-- MayIonics P6 reservation capacity guards
-- Append-only safety migration for Cloudflare D1 / SQLite.

CREATE TRIGGER reservation_capacity_before_insert
BEFORE INSERT ON product_reservations
WHEN NEW.status = 'ACTIVE'
BEGIN
  SELECT CASE
    WHEN COALESCE((SELECT quantity FROM products WHERE id = NEW.product_id AND status = 'ACTIVE'), 0)
      < NEW.reserved_quantity + COALESCE((
          SELECT SUM(reserved_quantity)
          FROM product_reservations
          WHERE product_id = NEW.product_id
            AND status = 'ACTIVE'
            AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        ), 0)
    THEN RAISE(ABORT, 'reservation_capacity_exceeded')
  END;
END;

CREATE TRIGGER reservation_capacity_before_update
BEFORE UPDATE OF product_id, reserved_quantity, status, expires_at ON product_reservations
WHEN NEW.status = 'ACTIVE'
BEGIN
  SELECT CASE
    WHEN COALESCE((SELECT quantity FROM products WHERE id = NEW.product_id AND status = 'ACTIVE'), 0)
      < NEW.reserved_quantity + COALESCE((
          SELECT SUM(reserved_quantity)
          FROM product_reservations
          WHERE product_id = NEW.product_id
            AND status = 'ACTIVE'
            AND id <> OLD.id
            AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        ), 0)
    THEN RAISE(ABORT, 'reservation_capacity_exceeded')
  END;
END;
