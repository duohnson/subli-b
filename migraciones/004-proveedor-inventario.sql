BEGIN;
CREATE TABLE proveedor_inventario (
  proveedor_id integer NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  inventario_id integer NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  PRIMARY KEY (proveedor_id, inventario_id)
);
INSERT INTO proveedor_inventario (proveedor_id, inventario_id)
SELECT p.id, i.id
FROM proveedores p
CROSS JOIN LATERAL unnest(string_to_array(p.productos, ',')) AS materiales(nombre)
JOIN inventario i ON lower(trim(i.nombre)) = lower(trim(materiales.nombre))
WHERE trim(materiales.nombre) <> ''
ON CONFLICT DO NOTHING;
COMMIT;
