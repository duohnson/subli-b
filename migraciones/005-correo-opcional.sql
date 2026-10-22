BEGIN;
ALTER TABLE clientes ALTER COLUMN correo DROP NOT NULL;
UPDATE clientes SET correo = NULL WHERE btrim(correo) = '';
COMMIT;
