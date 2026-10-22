BEGIN;
LOCK TABLE inventario, recetas, reservas, compras IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM inventario WHERE existencias <> trunc(existencias) OR reservado <> trunc(reservado) OR minimo <> trunc(minimo)) THEN
    RAISE EXCEPTION 'Hay cantidades fraccionarias en inventario. Revisarlas antes de migrar, sin redondear inventario.';
  END IF;
  IF EXISTS (SELECT 1 FROM recetas WHERE cantidad <> trunc(cantidad)) THEN
    RAISE EXCEPTION 'Hay cantidades fraccionarias en recetas. Revisarlas antes de migrar, sin redondear inventario.';
  END IF;
  IF EXISTS (SELECT 1 FROM reservas WHERE cantidad <> trunc(cantidad)) THEN
    RAISE EXCEPTION 'Hay cantidades fraccionarias en reservas. Revisarlas antes de migrar, sin redondear inventario.';
  END IF;
  IF EXISTS (SELECT 1 FROM compras WHERE cantidad <> trunc(cantidad)) THEN
    RAISE EXCEPTION 'Hay cantidades fraccionarias en compras. Revisarlas antes de migrar, sin redondear inventario.';
  END IF;
END;
$$;
ALTER TABLE inventario ALTER COLUMN existencias TYPE integer USING existencias::integer, ALTER COLUMN reservado TYPE integer USING reservado::integer, ALTER COLUMN minimo TYPE integer USING minimo::integer;
ALTER TABLE recetas ALTER COLUMN cantidad TYPE integer USING cantidad::integer;
ALTER TABLE reservas ALTER COLUMN cantidad TYPE integer USING cantidad::integer;
ALTER TABLE compras ALTER COLUMN cantidad TYPE integer USING cantidad::integer;
COMMIT;
