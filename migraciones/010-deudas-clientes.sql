ALTER TABLE clientes ADD COLUMN deudas jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(deudas) = 'array');
