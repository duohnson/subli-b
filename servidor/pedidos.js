import { randomBytes } from 'node:crypto';
import { sql } from './base.js';
import { mensajeListo } from './mensajes.js';
import { exigir, texto, entero, correoOpcional, fecha, transiciones } from './utilidades.js';

export async function crearPedido(datos, privado = false, vendedor = null, conexion = sql) {
  exigir(Array.isArray(datos.partidas) && datos.partidas.length > 0 && datos.partidas.length <= 30, 'Agregá entre 1 y 30 productos');
  return conexion.begin(async consulta => {
    let cliente;
    if (privado && datos.cliente_id) {
      [cliente] = await consulta`SELECT * FROM clientes WHERE id = ${entero(datos.cliente_id)}`;
      exigir(cliente, 'Cliente no encontrado');
    } else {
      exigir(texto(datos.nombre), 'Ingresá tu nombre');
      [cliente] = await consulta`INSERT INTO clientes (nombre, correo, telefono, direccion) VALUES (${texto(datos.nombre)}, ${correoOpcional(datos.correo)}, ${texto(datos.telefono)}, ${texto(datos.direccion)}) ON CONFLICT (correo) DO UPDATE SET correo = EXCLUDED.correo RETURNING *`;
    }
    const partidas = [];
    let total = 0;
    let costo = 0;
    for (const partida of datos.partidas) {
      const [variante] = await consulta`SELECT i.*, p.precio, p.activo FROM inventario i JOIN productos p ON p.id = i.producto_id WHERE i.id = ${entero(partida.variante_id)}`;
      exigir(variante?.activo, 'Producto no disponible');
      const cantidad = entero(partida.cantidad);
      exigir(cantidad <= 10000, 'La cantidad máxima por producto es 10000');
      const [materiales] = await consulta`SELECT COALESCE(sum(r.cantidad * i.costo), 0) AS costo FROM recetas r JOIN inventario i ON i.id = r.material_id WHERE r.variante_id = ${variante.id}`;
      total += Number(variante.precio) * cantidad;
      costo += (Number(variante.costo) + Number(materiales.costo)) * cantidad;
      // guardar el costo y precio actuales para conservar la referencia de esta cotizacion
      partidas.push({ variante_id: variante.id, cantidad, precio: variante.precio, costo_unitario: (Number(variante.costo) + Number(materiales.costo)).toFixed(2), nombre_personalizado: texto(partida.nombre_personalizado) });
    }
    const [pedido] = await consulta`INSERT INTO pedidos (codigo, cliente_id, instrucciones, vista_previa, total, costo, fecha_prometida, vendedor_id) VALUES (${randomBytes(24).toString('hex')}, ${cliente.id}, ${texto(datos.instrucciones, 3000)}, ${datos.vista_previa === true}, ${total.toFixed(2)}, ${costo.toFixed(2)}, ${privado ? fecha(datos.fecha_prometida) : null}, ${privado ? vendedor : null}) RETURNING *`;
    for (const partida of partidas) await consulta`INSERT INTO partidas ${consulta({ ...partida, pedido_id: pedido.id })}`;
    return pedido;
  });
}

export async function cambiarEstado(id, estado, codigo = null, conexion = sql, notificar = true) {
  return conexion.begin(async consulta => {
    const [pedido] = await consulta`SELECT * FROM pedidos WHERE id = ${id} FOR UPDATE`;
    exigir(pedido, 'Pedido no encontrado', 404);
    if (codigo !== null) {
      exigir(pedido.codigo === codigo, 'Pedido no encontrado', 404);
      if (pedido.estado === 'pendiente' && estado === 'pendiente') return pedido;
    }
    exigir(transiciones[pedido.estado].includes(estado), 'Ese cambio de estado no está permitido');
    if (estado === 'pendiente') {
      const necesidades = await consulta`
        SELECT inventario_id, sum(cantidad) AS cantidad FROM (
          SELECT variante_id AS inventario_id, cantidad FROM partidas WHERE pedido_id = ${id}
          UNION ALL
          SELECT r.material_id, p.cantidad * r.cantidad FROM partidas p JOIN recetas r ON r.variante_id = p.variante_id WHERE p.pedido_id = ${id}
        ) materiales GROUP BY inventario_id ORDER BY inventario_id`;
      // procesar los materiales por id para mantener el mismo orden de bloqueo
      for (const necesidad of necesidades) {
        // reservar solo si alcanza lo disponible, todo dentro del mismo update
        const [material] = await consulta`UPDATE inventario SET reservado = reservado + ${necesidad.cantidad} WHERE id = ${necesidad.inventario_id} AND existencias - reservado >= ${necesidad.cantidad} RETURNING id`;
        exigir(material, 'Inventario insuficiente. Revisá los productos y materiales');
        await consulta`INSERT INTO reservas (pedido_id, inventario_id, cantidad) VALUES (${id}, ${material.id}, ${necesidad.cantidad})`;
      }
    }
    if (estado === 'produccion') {
      exigir(!pedido.vista_previa || pedido.diseno_aprobado, 'El cliente o el administrador debe aprobar el diseño antes de producir');
      const reservas = await consulta`SELECT * FROM reservas WHERE pedido_id = ${id} AND NOT consumido ORDER BY inventario_id`;
      for (const reserva of reservas) await consulta`UPDATE inventario SET existencias = existencias - ${reserva.cantidad}, reservado = reservado - ${reserva.cantidad} WHERE id = ${reserva.inventario_id}`;
      await consulta`UPDATE reservas SET consumido = true WHERE pedido_id = ${id}`;
    }
    // liberar lo reservado sin aumentar la existencia fisica, porque aun no se habia consumido
    if (estado === 'cancelado') {
      const reservas = await consulta`SELECT * FROM reservas WHERE pedido_id = ${id} AND NOT consumido ORDER BY inventario_id`;
      for (const reserva of reservas) await consulta`UPDATE inventario SET reservado = reservado - ${reserva.cantidad} WHERE id = ${reserva.inventario_id}`;
      await consulta`DELETE FROM reservas WHERE pedido_id = ${id} AND NOT consumido`;
    }
    const [actualizado] = await consulta`UPDATE pedidos SET estado = ${estado} WHERE id = ${id} RETURNING *`;
    if (estado === 'listo' && notificar) {
      const [cliente] = await consulta`SELECT * FROM clientes WHERE id = ${pedido.cliente_id}`;
      const mensaje = mensajeListo(cliente.nombre, id);
      if (cliente.correo) await consulta`INSERT INTO notificaciones (clave, destinatario, asunto, mensaje) VALUES (${`listo-${id}`}, ${cliente.correo}, 'Tu pedido está listo · Subli’B', ${mensaje}) ON CONFLICT DO NOTHING`;
    }
    return actualizado;
  });
}

// sumar los pagos por pedido antes de unirlos para no repetir montos
export async function listarPedidos() {
  return sql`SELECT p.*, c.nombre AS cliente, c.correo, u.nombre AS responsable, COALESCE(m.pagado, 0) AS pagado, p.total - COALESCE(m.pagado, 0) AS saldo
    FROM pedidos p JOIN clientes c ON c.id = p.cliente_id LEFT JOIN usuarios u ON u.id = p.responsable_id
    LEFT JOIN (SELECT pedido_id, sum(monto) AS pagado FROM movimientos WHERE pedido_id IS NOT NULL GROUP BY pedido_id) m ON m.pedido_id = p.id
    ORDER BY p.creado DESC`;
}

export async function editarPedidoCliente(codigo, datos, conexion = sql) {
  return conexion.begin(async consulta => {
    const [pedido] = await consulta`SELECT * FROM pedidos WHERE codigo = ${codigo} FOR UPDATE`;
    exigir(pedido, 'Pedido no encontrado', 404);
    exigir(['cotizacion', 'pendiente'].includes(pedido.estado), 'El pedido ya no permite cambios');
    const partidas = await consulta`SELECT * FROM partidas WHERE pedido_id = ${pedido.id} ORDER BY id`;
    exigir(Array.isArray(datos.partidas) && datos.partidas.length === partidas.length, 'Revisá los productos del pedido');
    exigir(new Set(datos.partidas.map(p => Number(p.id))).size === partidas.length, 'Hay productos repetidos');
    let total = 0;
    let costo = 0;
    for (const partida of partidas) {
      const cambio = datos.partidas.find(p => Number(p.id) === partida.id);
      exigir(cambio, 'Producto ajeno al pedido');
      const cantidad = entero(cambio.cantidad);
      exigir(cantidad <= 10000, 'La cantidad máxima por producto es 10000');
      // mantener las cantidades confirmadas porque ya tienen inventario reservado
      exigir(pedido.estado === 'cotizacion' || cantidad === partida.cantidad, 'Para cambiar cantidades de un pedido confirmado, contactá al negocio');
      await consulta`UPDATE partidas SET cantidad = ${cantidad}, nombre_personalizado = ${texto(cambio.nombre_personalizado)} WHERE id = ${partida.id}`;
      total += Number(partida.precio) * cantidad;
      costo += Number(partida.costo_unitario) * cantidad;
    }
    const [pagos] = await consulta`SELECT COALESCE(sum(monto), 0) AS total FROM movimientos WHERE pedido_id = ${pedido.id}`;
    exigir(total >= Number(pagos.total), 'El total no puede ser menor que los adelantos registrados');
    await consulta`UPDATE pedidos SET instrucciones = ${texto(datos.instrucciones, 3000)}, total = ${total.toFixed(2)}, costo = ${costo.toFixed(2)}, diseno_aprobado = false WHERE id = ${pedido.id}`;
    return { mensaje: pedido.vista_previa ? 'Cambios guardados. La aprobación del diseño debe revisarse nuevamente.' : 'Cambios guardados.' };
  });
}

export async function aprobarDiseno(referencia, desdeAdmin = false, consulta = sql) {
  const filtro = desdeAdmin ? consulta`id = ${referencia}` : consulta`codigo = ${referencia}`;
  const [pedido] = await consulta`UPDATE pedidos SET diseno_aprobado = true WHERE ${filtro} AND vista_previa AND estado IN ('cotizacion', 'pendiente') AND (${desdeAdmin} OR EXISTS (SELECT 1 FROM archivos WHERE pedido_id = pedidos.id AND es_previa)) RETURNING id`;
  exigir(pedido, 'El pedido no permite aprobar el diseño o falta la vista previa');
  return { mensaje: 'Diseño aprobado para producción' };
}

// Una acción del panel puede completar las etapas intermedias en la misma transacción.
export async function avanzarPedido(id, destino, conexion = sql) {
  exigir(['listo','entregado'].includes(destino), 'Elegí listo o entregado');
  return conexion.begin(async consulta => {
    const [pedido] = await consulta`SELECT * FROM pedidos WHERE id = ${id} FOR UPDATE`;
    exigir(pedido, 'Pedido no encontrado', 404);
    exigir(['pendiente','produccion','listo'].includes(pedido.estado), 'Aprobá el pedido antes de completar el trabajo');
    const etapas = ['pendiente','produccion','listo','entregado'];
    exigir(etapas.indexOf(destino) > etapas.indexOf(pedido.estado), 'El pedido ya alcanzó ese estado');
    let actualizado = pedido;
    for (const estado of etapas.slice(etapas.indexOf(pedido.estado) + 1, etapas.indexOf(destino) + 1)) {
      actualizado = await cambiarEstado(id, estado, null, { begin: fn => fn(consulta) }, estado === destino);
    }
    return actualizado;
  });
}
