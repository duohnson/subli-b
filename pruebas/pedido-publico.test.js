import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from '../servidor/base.js';
import { editarPedidoCliente, cambiarEstado, aprobarDiseno } from '../servidor/pedidos.js';

test('El enlace del cliente permite editar y confirmar sin alterar otros pedidos ni reservas', { skip: process.env.PROBAR_POSTGRES !== '1' }, async () => {
  const revertir = Error('revertir prueba');
  try {
    await sql.begin(async consulta => {
      const conexion = { begin: tarea => consulta.savepoint(tarea) };
      const [cliente] = await consulta`INSERT INTO clientes (nombre, correo) VALUES ('Prueba enlace', ${randomUUID() + '@example.test'}) RETURNING id`;
      const [producto] = await consulta`INSERT INTO productos (nombre, categoria, precio) VALUES ('Prueba enlace', 'Prueba', 100) RETURNING id`;
      const [variante] = await consulta`INSERT INTO inventario (producto_id, nombre, existencias) VALUES (${producto.id}, 'Prueba enlace', 10) RETURNING id`;
      const codigo = randomUUID();
      const [pedido] = await consulta`INSERT INTO pedidos (codigo, cliente_id, total, costo, diseno_aprobado) VALUES (${codigo}, ${cliente.id}, 100, 40, true) RETURNING id`;
      const [partida] = await consulta`INSERT INTO partidas (pedido_id, variante_id, cantidad, precio, costo_unitario) VALUES (${pedido.id}, ${variante.id}, 1, 100, 40) RETURNING id`;
      const datos = { instrucciones: 'Texto de prueba', partidas: [{ id: partida.id, cantidad: 2, nombre_personalizado: 'Nombre' }], total: 1, estado: 'entregado' };
      await assert.rejects(editarPedidoCliente('codigo-inexistente', datos, conexion));
      await assert.rejects(editarPedidoCliente(codigo, { ...datos, partidas: [{ ...datos.partidas[0], id: partida.id + 100 }] }, conexion));
      await editarPedidoCliente(codigo, datos, conexion);
      const [editado] = await consulta`SELECT total, costo, estado, diseno_aprobado FROM pedidos WHERE id = ${pedido.id}`;
      assert.equal(Number(editado.total), 200);
      assert.equal(Number(editado.costo), 80);
      assert.equal(editado.estado, 'cotizacion');
      assert.equal(editado.diseno_aprobado, false);
      await assert.rejects(cambiarEstado(pedido.id, 'pendiente', 'otro-codigo', conexion));
      await cambiarEstado(pedido.id, 'pendiente', codigo, conexion);
      await cambiarEstado(pedido.id, 'pendiente', codigo, conexion);
      const [inventario] = await consulta`SELECT reservado FROM inventario WHERE id = ${variante.id}`;
      assert.equal(Number(inventario.reservado), 2);
      await assert.rejects(editarPedidoCliente(codigo, { ...datos, partidas: [{ ...datos.partidas[0], cantidad: 3 }] }, conexion));
      await editarPedidoCliente(codigo, datos, conexion);
      await consulta`UPDATE pedidos SET vista_previa = true WHERE id = ${pedido.id}`;
      await assert.rejects(aprobarDiseno(codigo, false, consulta));
      await assert.rejects(cambiarEstado(pedido.id, 'produccion', null, conexion));
      await aprobarDiseno(pedido.id, true, consulta);
      await editarPedidoCliente(codigo, datos, conexion);
      await assert.rejects(cambiarEstado(pedido.id, 'produccion', null, conexion));
      await consulta`INSERT INTO archivos (pedido_id, nombre, ruta, tipo, es_previa) VALUES (${pedido.id}, 'Vista previa', 'prueba', 'image/png', true)`;
      await aprobarDiseno(codigo, false, consulta);
      await cambiarEstado(pedido.id, 'produccion', null, conexion);
      await assert.rejects(aprobarDiseno(pedido.id, true, consulta));
      await assert.rejects(editarPedidoCliente(codigo, datos, conexion));
      await assert.rejects(cambiarEstado(pedido.id, 'pendiente', codigo, conexion));
      throw revertir;
    });
  } catch (error) { if (error !== revertir) throw error; }
  finally { await sql.end(); }
});
