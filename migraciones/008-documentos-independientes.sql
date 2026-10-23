BEGIN;
ALTER TABLE documentos ALTER COLUMN pedido_id DROP NOT NULL;
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_pedido_obligatorio;
ALTER TABLE documentos ADD CONSTRAINT documentos_pedido_obligatorio CHECK (tipo NOT IN ('factura','comprobante') OR pedido_id IS NOT NULL);
COMMIT;
