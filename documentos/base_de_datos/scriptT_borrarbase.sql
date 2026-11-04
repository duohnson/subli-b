BEGIN;

SELECT 'sesiones' AS tabla, count(*) AS registros FROM sesiones
UNION ALL SELECT 'pedidos', count(*) FROM pedidos
UNION ALL SELECT 'partidas', count(*) FROM partidas
UNION ALL SELECT 'clientes', count(*) FROM clientes
UNION ALL SELECT 'archivos de pedidos', count(*) FROM archivos
UNION ALL SELECT 'documentos', count(*) FROM documentos
UNION ALL SELECT 'movimientos', count(*) FROM movimientos
UNION ALL SELECT 'compras', count(*) FROM compras
UNION ALL SELECT 'proveedores', count(*) FROM proveedores
UNION ALL SELECT 'recordatorios', count(*) FROM recordatorios
UNION ALL SELECT 'notificaciones', count(*) FROM notificaciones
UNION ALL SELECT 'productos conservados', count(*) FROM productos
UNION ALL SELECT 'variantes conservadas', count(*) FROM inventario WHERE producto_id IS NOT NULL
UNION ALL SELECT 'imágenes de portada conservadas', count(*) FROM contenidos WHERE seccion = 'portada'
UNION ALL SELECT 'trabajos conservados', count(*) FROM contenidos WHERE seccion = 'galeria';

TRUNCATE TABLE
  sesiones,
  pagos_salarios,
  documentos,
  movimientos,
  archivos,
  reservas,
  partidas,
  pedidos,
  clientes,
  compras,
  proveedor_inventario,
  proveedores,
  recordatorios,
  notificaciones
RESTART IDENTITY;

UPDATE inventario SET reservado = 0;

SELECT 'sesiones' AS tabla, count(*) AS registros FROM sesiones
UNION ALL SELECT 'pedidos', count(*) FROM pedidos
UNION ALL SELECT 'partidas', count(*) FROM partidas
UNION ALL SELECT 'clientes', count(*) FROM clientes
UNION ALL SELECT 'archivos de pedidos', count(*) FROM archivos
UNION ALL SELECT 'documentos', count(*) FROM documentos
UNION ALL SELECT 'movimientos', count(*) FROM movimientos
UNION ALL SELECT 'compras', count(*) FROM compras
UNION ALL SELECT 'proveedores', count(*) FROM proveedores
UNION ALL SELECT 'recordatorios', count(*) FROM recordatorios
UNION ALL SELECT 'notificaciones', count(*) FROM notificaciones
UNION ALL SELECT 'productos conservados', count(*) FROM productos
UNION ALL SELECT 'variantes conservadas', count(*) FROM inventario WHERE producto_id IS NOT NULL
UNION ALL SELECT 'imágenes de portada conservadas', count(*) FROM contenidos WHERE seccion = 'portada'
UNION ALL SELECT 'trabajos conservados', count(*) FROM contenidos WHERE seccion = 'galeria';

COMMIT;
