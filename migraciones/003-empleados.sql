BEGIN;
CREATE TABLE empleados (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  correo text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  puesto text NOT NULL,
  salario numeric(12,2) NOT NULL DEFAULT 0 CHECK (salario >= 0),
  usuario_id integer UNIQUE REFERENCES usuarios(id),
  activo boolean NOT NULL DEFAULT true
);
ALTER TABLE pedidos ADD COLUMN vendedor_id integer REFERENCES usuarios(id);
CREATE INDEX pedidos_vendedor ON pedidos(vendedor_id);
CREATE TABLE pagos_salarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empleado_id integer NOT NULL REFERENCES empleados(id),
  periodo date NOT NULL CHECK (extract(day FROM periodo) = 1),
  movimiento_id integer NOT NULL UNIQUE REFERENCES movimientos(id),
  registrado_por integer NOT NULL REFERENCES usuarios(id),
  UNIQUE (empleado_id, periodo)
);
COMMIT;
