import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from '../servidor/base.js';
import { guardarEmpleado, crearUsuarioEmpleado, pagarSalario, ventasPorUsuario } from '../servidor/empleados.js';
import { crearPedido } from '../servidor/pedidos.js';
import { obtenerEstadisticas } from '../servidor/estadisticas.js';

test('Salarios integrados a gastos sin duplicados y ventas por usuario', { skip: process.env.PROBAR_POSTGRES !== '1' }, async () => {
  const revertir = Error('revertir empleados de prueba');
  try {
    await sql.begin(async consulta => {
      const conexion = { begin: tarea => consulta.savepoint(tarea) };
      const empleado = await guardarEmpleado({ nombre: 'Empleado prueba', puesto: 'Vendedor', salario: 305000, activo: true }, null, conexion);
      assert.equal(empleado.correo, null);
      const editado = await guardarEmpleado({ ...empleado, correo: '   ' }, empleado.id, conexion);
      assert.equal(editado.correo, null);
      await assert.rejects(guardarEmpleado({ ...empleado, correo: 'incorrecto' }, empleado.id, conexion), /correo válido/);
      const acceso = { correo: randomUUID() + '@example.test', clave: 'clave-de-prueba-123', rol: 'operador' };
      await crearUsuarioEmpleado(empleado.id, acceso, conexion);
      const [usuario] = await consulta`SELECT * FROM usuarios WHERE correo = ${acceso.correo}`;
      assert.equal(usuario.rol, 'operador');
      await assert.rejects(crearUsuarioEmpleado(empleado.id, acceso, conexion));
      const [antes] = await consulta`SELECT COALESCE(sum(monto) FILTER (WHERE tipo='gasto'),0) AS gastos FROM movimientos WHERE fecha BETWEEN '2088-01-01' AND '2088-12-31'`;
      const pago = { periodo: '2088-01', fecha: '2088-01-31', monto: 305000, medio: 'sinpe', cuenta: 'Prueba' };
      await pagarSalario(empleado.id, pago, usuario.id, conexion);
      await assert.rejects(pagarSalario(empleado.id, pago, usuario.id, conexion), /ya está registrado/);
      const datos = await obtenerEstadisticas(2088, consulta);
      assert.equal(Number(datos.efectivo.gastos) - Number(antes.gastos), 305000);
      const [pagos] = await consulta`SELECT count(*)::integer AS cantidad FROM pagos_salarios WHERE empleado_id=${empleado.id}`;
      assert.equal(pagos.cantidad, 1);
      const [cliente] = await consulta`INSERT INTO clientes (nombre, correo) VALUES ('Cliente de prueba', ${randomUUID()+'@example.test'}) RETURNING id`;
      const [producto] = await consulta`INSERT INTO productos (nombre, categoria, precio) VALUES ('Prueba vendedor', 'Prueba', 1000) RETURNING id`;
      const [variante] = await consulta`INSERT INTO inventario (nombre, producto_id, existencias) VALUES ('Prueba vendedor', ${producto.id}, 5) RETURNING id`;
      const solicitud = { cliente_id: cliente.id, vendedor_id: null, partidas: [{ variante_id: variante.id, cantidad: 1 }] };
      const creado = await crearPedido(solicitud, true, usuario.id, conexion);
      assert.equal(creado.vendedor_id, usuario.id);
      const publico = await crearPedido({ ...solicitud, vendedor_id: usuario.id, nombre: 'Cliente público', correo: randomUUID()+'@example.test' }, false, null, conexion);
      assert.equal(publico.vendedor_id, null);
      for (const [estado, total] of [['pendiente',1000],['entregado',2000],['cotizacion',9000],['cancelado',8000]]) {
        await consulta`INSERT INTO pedidos (codigo, cliente_id, vendedor_id, estado, total, creado) VALUES (${randomUUID()}, ${cliente.id}, ${usuario.id}, ${estado}, ${total}, '2088-01-20')`;
      }
      const ventas = (await ventasPorUsuario('2088-01-01','2088-12-31',consulta)).find(f => f.vendedor_id === usuario.id);
      assert.equal(Number(ventas.ventas), 3000);
      assert.equal(ventas.pedidos, 2);
      assert.equal(ventas.puesto, 'Vendedor');
      await assert.rejects(guardarEmpleado({ ...empleado, usuario_id: null }, empleado.id, conexion), /no se puede reemplazar/);
      await guardarEmpleado({ ...empleado, usuario_id: usuario.id, activo: false }, empleado.id, conexion);
      const [inactivo] = await consulta`SELECT activo FROM usuarios WHERE id=${usuario.id}`;
      assert.equal(inactivo.activo,false);
      await assert.rejects(pagarSalario(empleado.id,{...pago,periodo:'2088-02'},usuario.id,conexion));
      throw revertir;
    });
  } catch (error) { if (error !== revertir) throw error; }
  finally { await sql.end(); }
});
