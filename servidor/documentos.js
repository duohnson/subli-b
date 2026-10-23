import { sql } from './base.js';
import { exigir, entero, numero, texto, correoOpcional } from './utilidades.js';

export function prepararDocumentoIndependiente(datos) {
  exigir(Array.isArray(datos.partidas) && datos.partidas.length > 0 && datos.partidas.length <= 30, 'Agregá entre 1 y 30 partidas');
  const partidas = datos.partidas.map(p => {
    exigir(p && texto(p.nombre), 'Escribí la descripción de cada partida');
    const cantidad = entero(p.cantidad);
    exigir(cantidad <= 10000, 'La cantidad máxima por partida es 10000');
    return { nombre: texto(p.nombre), cantidad, precio: Number(numero(p.precio).toFixed(2)) };
  });
  const total = numero(Number(partidas.reduce((s, p) => s + p.cantidad * p.precio, 0).toFixed(2)));
  exigir(datos.tipo !== 'recibo' || total > 0, 'El recibo debe tener un importe mayor que cero');
  return { total, detalle: { cliente: texto(datos.cliente) || 'Cliente general', correo: correoOpcional(datos.correo), direccion: texto(datos.direccion), partidas, pagado: datos.tipo === 'recibo' ? total : 0 } };
}

export async function crearDocumento(datos, conexion = sql) {
  const id = datos.pedido_id ? entero(datos.pedido_id) : null;
  const tipo = texto(datos.tipo);
  exigir(['cotizacion','proforma','recibo','comprobante','nota_credito','factura'].includes(tipo), 'Tipo de documento inválido');
  exigir(id || !['factura','comprobante'].includes(tipo), 'Seleccioná un pedido para la factura o el comprobante');
  const documento = await conexion.begin(async consulta => {
    if (!id) {
      const { total, detalle } = prepararDocumentoIndependiente({ ...datos, tipo });
      const [documento] = await consulta`INSERT INTO documentos (pedido_id, tipo, total, detalle) VALUES (NULL, ${tipo}, ${total}, ${consulta.json(detalle)}) RETURNING *`;
      return documento;
    }
    const [pedido] = await consulta`SELECT p.*, c.nombre, c.correo, c.direccion FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ${id} FOR UPDATE OF p`;
    exigir(pedido, 'Pedido no encontrado', 404);
    exigir(tipo !== 'factura' || !['cotizacion','cancelado'].includes(pedido.estado), 'Aprobá la cotización antes de facturar');
    if (tipo === 'factura') {
      const existentes = await consulta`SELECT id FROM documentos WHERE pedido_id = ${id} AND tipo = 'factura'`;
      exigir(!existentes.length, 'El pedido ya tiene una factura');
    }
    const partidas = await consulta`SELECT pa.cantidad, pa.precio, pa.nombre_personalizado, i.nombre, i.color, i.talla FROM partidas pa JOIN inventario i ON i.id = pa.variante_id WHERE pa.pedido_id = ${id}`;
    const [pagos] = await consulta`SELECT COALESCE(sum(monto), 0) AS total FROM movimientos WHERE pedido_id = ${id}`;
    const total = ['recibo','comprobante'].includes(tipo) ? pagos.total : pedido.total;
    exigir(!['recibo','comprobante'].includes(tipo) || Number(total) > 0, 'No hay pagos registrados');
    if (tipo === 'nota_credito') {
      const [factura] = await consulta`SELECT id FROM documentos WHERE pedido_id = ${id} AND tipo = 'factura'`;
      exigir(factura, 'Primero debe existir una factura');
    }
    // guardar una copia de los datos para q el documento no cambie al editar el cliente
    const [documento] = await consulta`INSERT INTO documentos (pedido_id, tipo, total, detalle) VALUES (${id}, ${tipo}, ${total}, ${consulta.json({ cliente: pedido.nombre, correo: pedido.correo, direccion: pedido.direccion, partidas, pagado: pagos.total })}) RETURNING *`;
    return documento;
  });
  return documento;
}
