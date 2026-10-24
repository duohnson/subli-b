import { ventasPorUsuario } from './empleados.js';
import { sql } from './base.js';
import { entero, exigir } from './utilidades.js';

export async function obtenerEstadisticas(valor, consulta = sql) {
  const anio = entero(valor);
  exigir(anio >= 2000 && anio <= 2100, 'Seleccioná un año entre 2000 y 2100');
  const inicio = `${anio - 1}-01-01`;
  const fin = `${anio + 1}-01-01`;
  const ventas = await consulta`SELECT extract(year FROM creado)::integer AS anio,
    extract(month FROM creado)::integer AS mes, sum(total) AS ventas,
    sum(costo) AS costo, count(*)::integer AS pedidos
    FROM pedidos WHERE creado >= ${inicio}::date AND creado < ${fin}::date
    AND estado NOT IN ('cotizacion','cancelado') GROUP BY 1, 2`;
  const meses = Array.from({ length: 12 }, (_, indice) => {
    const actual = ventas.find(fila => fila.anio === anio && fila.mes === indice + 1);
    const anterior = ventas.find(fila => fila.anio === anio - 1 && fila.mes === indice + 1);
    return { mes: indice + 1, ventas: Number(actual?.ventas || 0), anterior: Number(anterior?.ventas || 0), costo: Number(actual?.costo || 0), pedidos: Number(actual?.pedidos || 0) };
  });
  const resumen = meses.reduce((total, mes) => ({ ventas: total.ventas + mes.ventas, anterior: total.anterior + mes.anterior, costo: total.costo + mes.costo, pedidos: total.pedidos + mes.pedidos }), { ventas: 0, anterior: 0, costo: 0, pedidos: 0 });
  const desde = `${anio}-01-01`;
  // comparar categorias con el costo guardado al cotizar, no con el costo actual del catalogo
  const categorias = await consulta`SELECT pr.categoria,
    COALESCE(sum(pa.cantidad * pa.precio) FILTER (WHERE p.creado >= ${desde}::date), 0) AS ventas,
    COALESCE(sum(pa.cantidad * pa.precio) FILTER (WHERE p.creado < ${desde}::date), 0) AS anterior,
    COALESCE(sum(pa.cantidad * (pa.precio - pa.costo_unitario)) FILTER (WHERE p.creado >= ${desde}::date), 0) AS margen,
    COALESCE(sum(pa.cantidad) FILTER (WHERE p.creado >= ${desde}::date), 0) AS unidades
    FROM partidas pa JOIN pedidos p ON p.id = pa.pedido_id
    JOIN inventario i ON i.id = pa.variante_id JOIN productos pr ON pr.id = i.producto_id
    WHERE p.creado >= ${inicio}::date AND p.creado < ${fin}::date
    AND p.estado NOT IN ('cotizacion','cancelado') GROUP BY pr.categoria ORDER BY ventas DESC, pr.categoria`;
  const productos = await consulta`SELECT pr.id, pr.nombre, sum(pa.cantidad) AS unidades,
    sum(pa.cantidad * pa.precio) AS ventas FROM partidas pa JOIN pedidos p ON p.id = pa.pedido_id
    JOIN inventario i ON i.id = pa.variante_id JOIN productos pr ON pr.id = i.producto_id
    WHERE p.creado >= ${desde}::date AND p.creado < ${fin}::date AND p.estado NOT IN ('cotizacion','cancelado')
    GROUP BY pr.id ORDER BY unidades DESC, pr.nombre LIMIT 5`;
  const [clientes] = await consulta`SELECT count(DISTINCT cliente_id)::integer AS cantidad FROM pedidos
    WHERE creado >= ${desde}::date AND creado < ${fin}::date AND estado NOT IN ('cotizacion','cancelado')`;
  // mostrar el inventario de hoy aparte, porque no hay un historial de existencias por año
  const [inventario] = await consulta`SELECT count(*)::integer AS variantes,
    count(*) FILTER (WHERE existencias > 0 AND existencias - reservado <= minimo)::integer AS bajo FROM inventario`;
  // separar cobros y gastos de ventas aprobadas para no confundir el efectivo con lo facturado
  const [efectivo] = await consulta`SELECT
    COALESCE(sum(monto) FILTER (WHERE tipo = 'ingreso'), 0) AS cobros,
    COALESCE(sum(monto) FILTER (WHERE tipo = 'gasto'), 0) AS gastos,
    COALESCE(sum(comision), 0) AS comisiones FROM movimientos WHERE fecha >= ${desde}::date AND fecha < ${fin}::date`;
  const anios = await consulta`SELECT DISTINCT anio FROM (
    SELECT extract(year FROM creado)::integer AS anio FROM pedidos
    UNION SELECT extract(year FROM fecha)::integer FROM movimientos
    UNION SELECT extract(year FROM CURRENT_DATE)::integer
  ) fechas WHERE anio BETWEEN 2000 AND 2100 ORDER BY anio DESC`;
  const vendedores = await ventasPorUsuario(desde, `${anio}-12-31`, consulta);
  return { vendedores, anio, meses, resumen, categorias, productos, clientes: clientes.cantidad, inventario, efectivo, anios: anios.map(fila => fila.anio) };
}
