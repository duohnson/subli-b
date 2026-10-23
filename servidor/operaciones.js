import { sql } from './base.js';
import { exigir, entero, numero, numeroOpcional, texto, fecha, hoy } from './utilidades.js';

export async function registrarMovimiento(d, conexion = sql) {
  const monto = numero(d.monto, 0.01);
  const tipo = texto(d.tipo);
  exigir(['ingreso','gasto'].includes(tipo), 'Elegí ingreso o gasto');
  exigir(!d.pedido_id || (tipo === 'ingreso' && !d.compra_id), 'El cobro de un pedido debe ser un ingreso sin compra vinculada');
  exigir(!d.compra_id || tipo === 'gasto', 'El pago de una compra debe ser un gasto');
  const medio = texto(d.medio) || 'efectivo';
  exigir(['efectivo','banco','sinpe','tarjeta'].includes(medio), 'Elegí un medio de pago válido');
  const comision = numeroOpcional(d.comision);
  const impuesto = numeroOpcional(d.impuesto);
  exigir(comision <= monto && impuesto <= monto, 'La comisión y el impuesto no pueden superar el monto');
  return conexion.begin(async consulta => {
    let concepto = texto(d.concepto);
    if (d.pedido_id) {
      const [pedido] = await consulta`SELECT * FROM pedidos WHERE id = ${entero(d.pedido_id)} FOR UPDATE`;
      exigir(pedido && !['cotizacion','cancelado'].includes(pedido.estado), 'El pedido debe estar aprobado');
      const [pagos] = await consulta`SELECT COALESCE(sum(monto), 0) AS total FROM movimientos WHERE pedido_id = ${pedido.id}`;
      exigir(monto <= Number((Number(pedido.total) - Number(pagos.total)).toFixed(2)), 'El pago supera el saldo pendiente');
      concepto ||= `Cobro del pedido #${pedido.id}`;
    }
    if (d.compra_id) {
      const [compra] = await consulta`SELECT * FROM compras WHERE id = ${entero(d.compra_id)} FOR UPDATE`;
      exigir(compra, 'Compra no encontrada');
      const [pagos] = await consulta`SELECT COALESCE(sum(monto), 0) AS total FROM movimientos WHERE compra_id = ${compra.id}`;
      exigir(monto <= Number((Number(compra.cantidad) * Number(compra.costo_unitario) - Number(pagos.total)).toFixed(2)), 'El pago supera la deuda con el proveedor');
      concepto ||= `Pago de compra #${compra.id}`;
    }
    exigir(concepto, 'Escribí el concepto del movimiento sin pedido o compra');
    const [movimiento] = await consulta`INSERT INTO movimientos (tipo, concepto, monto, comision, impuesto, medio, cuenta, pedido_id, compra_id, fecha) VALUES (${tipo}, ${concepto}, ${monto}, ${comision}, ${impuesto}, ${medio}, ${texto(d.cuenta)}, ${d.pedido_id ? entero(d.pedido_id) : null}, ${d.compra_id ? entero(d.compra_id) : null}, ${fecha(d.fecha) || hoy()}) RETURNING *`;
    return movimiento;
  });
}

export async function registrarCompras(d, conexion = sql) {
  const proveedor = entero(d.proveedor_id);
  const partidas = d.partidas === undefined ? [d] : d.partidas;
  exigir(Array.isArray(partidas) && partidas.length > 0 && partidas.length <= 30, 'Agregá entre 1 y 30 materiales');
  const lineas = partidas.map(p => {
    exigir(p, 'Revisá los materiales de la compra');
    return { inventario_id: entero(p.inventario_id), cantidad: entero(p.cantidad), costo_unitario: numero(p.costo_unitario) };
  });
  exigir(new Set(lineas.map(p => p.inventario_id)).size === lineas.length, 'Unificá las cantidades de los materiales repetidos');
  return conexion.begin(async consulta => {
    const compras = [];
    for (const p of lineas.slice().sort((a,b) => a.inventario_id - b.inventario_id)) {
      const [compra] = await consulta`INSERT INTO compras (proveedor_id, inventario_id, cantidad, costo_unitario, factura, vencimiento, notas, recibida) VALUES (${proveedor}, ${p.inventario_id}, ${p.cantidad}, ${p.costo_unitario}, ${texto(d.factura)}, ${fecha(d.vencimiento)}, ${texto(d.notas)}, ${d.recibida === true}) RETURNING *`;
      await consulta`INSERT INTO proveedor_inventario (proveedor_id, inventario_id) VALUES (${proveedor}, ${p.inventario_id}) ON CONFLICT DO NOTHING`;
      if (compra.recibida) await consulta`UPDATE inventario SET existencias = existencias + ${compra.cantidad}, costo = ${compra.costo_unitario} WHERE id = ${compra.inventario_id}`;
      compras.push(compra);
    }
    return d.partidas === undefined ? compras[0] : compras;
  });
}
