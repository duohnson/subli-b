BEGIN;
CREATE TABLE usuarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  correo text NOT NULL UNIQUE,
  clave text NOT NULL,
  rol text NOT NULL DEFAULT 'operador' CHECK (rol IN ('administrador','operador')),
  activo boolean NOT NULL DEFAULT true
);
CREATE TABLE sesiones (
  token text PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vence timestamptz NOT NULL
);
CREATE TABLE clientes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  correo text UNIQUE,
  telefono text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  limite_credito numeric(12,2) NOT NULL DEFAULT 0 CHECK (limite_credito >= 0)
);
CREATE TABLE proveedores (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  correo text,
  telefono text NOT NULL DEFAULT '',
  productos text NOT NULL DEFAULT '',
  plazo_dias integer NOT NULL DEFAULT 0 CHECK (plazo_dias >= 0),
  notas text NOT NULL DEFAULT ''
);
CREATE TABLE productos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  categoria text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  imagen text NOT NULL DEFAULT '',
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  costo numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  promocion text NOT NULL DEFAULT '',
  personalizable boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  imagenes jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(imagenes) = 'array')
);
CREATE TABLE inventario (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto_id integer REFERENCES productos(id),
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '',
  talla text NOT NULL DEFAULT '',
  existencias integer NOT NULL DEFAULT 0 CHECK (existencias >= 0),
  reservado integer NOT NULL DEFAULT 0 CHECK (reservado >= 0 AND reservado <= existencias),
  minimo integer NOT NULL DEFAULT 0 CHECK (minimo >= 0),
  costo numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0)
);
CREATE TABLE proveedor_inventario (
  proveedor_id integer NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  inventario_id integer NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  PRIMARY KEY (proveedor_id, inventario_id)
);
CREATE TABLE recetas (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variante_id integer NOT NULL REFERENCES inventario(id),
  material_id integer NOT NULL REFERENCES inventario(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  UNIQUE(variante_id, material_id),
  CHECK (variante_id <> material_id)
);
CREATE TABLE pedidos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  cliente_id integer NOT NULL REFERENCES clientes(id),
  estado text NOT NULL DEFAULT 'cotizacion' CHECK (estado IN ('cotizacion','pendiente','produccion','listo','entregado','cancelado')),
  creado timestamptz NOT NULL DEFAULT now(),
  fecha_prometida date,
  fecha_pago date,
  responsable_id integer REFERENCES usuarios(id),
  instrucciones text NOT NULL DEFAULT '',
  vista_previa boolean NOT NULL DEFAULT false,
  diseno_aprobado boolean NOT NULL DEFAULT false,
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  costo numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0)
);
CREATE TABLE partidas (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id integer NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  variante_id integer NOT NULL REFERENCES inventario(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  costo_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  nombre_personalizado text NOT NULL DEFAULT ''
);
CREATE TABLE reservas (
  pedido_id integer NOT NULL REFERENCES pedidos(id),
  inventario_id integer NOT NULL REFERENCES inventario(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  consumido boolean NOT NULL DEFAULT false,
  PRIMARY KEY (pedido_id, inventario_id)
);
CREATE TABLE archivos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id integer NOT NULL REFERENCES pedidos(id),
  nombre text NOT NULL,
  ruta text NOT NULL,
  tipo text NOT NULL,
  es_previa boolean NOT NULL DEFAULT false,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE compras (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proveedor_id integer NOT NULL REFERENCES proveedores(id),
  inventario_id integer NOT NULL REFERENCES inventario(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  costo_unitario numeric(12,2) NOT NULL CHECK (costo_unitario >= 0),
  factura text NOT NULL DEFAULT '',
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  vencimiento date,
  recibida boolean NOT NULL DEFAULT false,
  notas text NOT NULL DEFAULT ''
);
CREATE TABLE movimientos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  concepto text NOT NULL,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  comision numeric(12,2) NOT NULL DEFAULT 0 CHECK (comision >= 0 AND comision <= monto),
  impuesto numeric(12,2) NOT NULL DEFAULT 0 CHECK (impuesto >= 0 AND impuesto <= monto),
  medio text NOT NULL CHECK (medio IN ('efectivo','banco','sinpe','tarjeta')),
  cuenta text NOT NULL DEFAULT '',
  pedido_id integer REFERENCES pedidos(id),
  compra_id integer REFERENCES compras(id),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  CHECK (pedido_id IS NULL OR (tipo = 'ingreso' AND compra_id IS NULL)),
  CHECK (compra_id IS NULL OR tipo = 'gasto')
);
CREATE TABLE documentos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id integer NOT NULL REFERENCES pedidos(id),
  tipo text NOT NULL CHECK (tipo IN ('cotizacion','proforma','recibo','comprobante','nota_credito','factura')),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  detalle jsonb NOT NULL,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE recordatorios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo text NOT NULL,
  fecha date NOT NULL,
  tipo text NOT NULL DEFAULT 'general' CHECK (tipo IN ('general','entrega','cobro','inventario','mantenimiento')),
  completado boolean NOT NULL DEFAULT false
);
CREATE TABLE notificaciones (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave text NOT NULL UNIQUE,
  destinatario text NOT NULL,
  asunto text NOT NULL,
  mensaje text NOT NULL,
  enviada timestamptz,
  intentos integer NOT NULL DEFAULT 0,
  error text,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE medios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  ruta text NOT NULL,
  tipo text NOT NULL,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contenidos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seccion text NOT NULL CHECK (seccion IN ('portada','galeria')),
  nombre text NOT NULL,
  imagen text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true
);
CREATE TABLE empleados (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  correo text,
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
CREATE INDEX pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX movimientos_pedido ON movimientos(pedido_id);
CREATE INDEX movimientos_fecha ON movimientos(fecha);
CREATE INDEX notificaciones_pendientes ON notificaciones(creado) WHERE enviada IS NULL;
INSERT INTO contenidos (seccion, nombre, imagen, orden) VALUES
('portada', 'Camiseta de Luffy con estampado dinámico', '/src/img/destacadas/Camiseta de Luffy con estampado dinámico.png', 0),
('portada', 'Taza de Naruto con fondo naranja', '/src/img/destacadas/Taza de Naruto con fondo naranja.png', 1),
('portada', 'Vaso azul de Demon Slayer con pajilla', '/src/img/destacadas/Vaso azul de Demon Slayer con pajilla.png', 2),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.07 (1).jpeg', 0),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.07 (2).jpeg', 1),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.07 (3).jpeg', 2),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.07 (4).jpeg', 3),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.07 (5).jpeg', 4),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.07.jpeg', 5),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (1).jpeg', 6),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (2).jpeg', 7),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (3).jpeg', 8),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (4).jpeg', 9),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (5).jpeg', 10),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (6).jpeg', 11),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08 (7).jpeg', 12),
('galeria', 'Trabajo personalizado de Subli’B', '/src/img/catalogos/WhatsApp Image 2026-10-14 at 19.10.08.jpeg', 13);
COMMIT;
