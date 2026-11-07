BEGIN;
ALTER TABLE pedidos ADD COLUMN descuento numeric(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0);
COMMIT;
