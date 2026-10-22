BEGIN;
ALTER TABLE productos ADD COLUMN imagenes jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(imagenes) = 'array');
COMMIT;
