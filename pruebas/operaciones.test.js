import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from '../servidor/base.js';
import { registrarCompras, registrarMovimiento } from '../servidor/operaciones.js';
import { crearPedido, cambiarEstado, avanzarPedido } from '../servidor/pedidos.js';
import { guardarEmpleado } from '../servidor/empleados.js';
import { numeroOpcional, calcularPrecio } from '../servidor/utilidades.js';

test('Los campos numéricos opcionales admiten vacío sin aceptar números inválidos', () => {
  for (const valor of ['', '   ', null, undefined]) assert.equal(numeroOpcional(valor), 0);
  assert.equal(numeroOpcional('', 1), 1);
  for (const valor of [-1, Infinity, 'incorrecto']) assert.throws(() => numeroOpcional(valor));
  const calculo = calcularPrecio({producto:100, materiales:'', margen:'', cantidad:1, iva:true, iva_porcentaje:''});
  assert.equal(calculo.costo,100);
  assert.equal(calculo.totalConIva,113);
});

test('Compras múltiples, recepción inmediata, cobros simples y datos secundarios opcionales', {skip:process.env.PROBAR_POSTGRES !== '1'}, async () => {
  const revertir = Error('revertir operaciones');
  try {
    await sql.begin(async consulta => {
      const conexion = { begin: fn => consulta.savepoint(fn) };
      const [proveedor] = await consulta`INSERT INTO proveedores (nombre) VALUES ('Prueba operaciones') RETURNING id`;
      const materiales = await consulta`INSERT INTO inventario (nombre, existencias) VALUES ('Material A',3), ('Material B',5) RETURNING *`;
      const compra = {proveedor_id:proveedor.id, recibida:true, partidas: materiales.map(m => ({inventario_id:m.id,cantidad:2,costo_unitario:12.50}))};
      const compras = await registrarCompras(compra,conexion);
      assert.equal(compras.length,2);
      for (const material of materiales) {
        const [actual] = await consulta`SELECT * FROM inventario WHERE id = ${material.id}`;
        assert.equal(actual.existencias,material.existencias+2);
        assert.equal(Number(actual.costo),12.50);
      }
      assert.equal((await consulta`SELECT * FROM proveedor_inventario WHERE proveedor_id = ${proveedor.id}`).length,2);
      await assert.rejects(registrarCompras({...compra,partidas:[compra.partidas[0],{inventario_id:999999999,cantidad:1,costo_unitario:20}]},conexion));
      assert.equal((await consulta`SELECT * FROM compras WHERE proveedor_id = ${proveedor.id}`).length,2);
      const [sinCambio] = await consulta`SELECT existencias FROM inventario WHERE id = ${materiales[0].id}`;
      assert.equal(sinCambio.existencias,materiales[0].existencias+2);
      await assert.rejects(registrarCompras({...compra,partidas:[compra.partidas[0],compra.partidas[0]]},conexion), /repetidos/);
      const pago = await registrarMovimiento({tipo:'gasto',compra_id:compras[0].id,monto:25,comision:'',impuesto:''},conexion);
      assert.equal(pago.concepto,`Pago de compra #${compras[0].id}`);
      assert.equal(Number(pago.comision),0);
      await assert.rejects(registrarMovimiento({tipo:'gasto',compra_id:compras[0].id,monto:1},conexion), /deuda/);
      await assert.rejects(registrarMovimiento({tipo:'ingreso',compra_id:compras[1].id,monto:1},conexion), /gasto/);
      await assert.rejects(registrarMovimiento({tipo:'gasto',monto:10},conexion), /concepto/);
      await assert.rejects(registrarMovimiento({tipo:'gasto',monto:10,concepto:'X',comision:11},conexion), /superar/);
      const [cliente] = await consulta`INSERT INTO clientes (nombre) VALUES ('Prueba cobro') RETURNING id`;
      const [pedido] = await consulta`INSERT INTO pedidos (codigo,cliente_id,estado,total) VALUES (${randomUUID()},${cliente.id},'pendiente',0.30) RETURNING id`;
      await registrarMovimiento({tipo:'ingreso',pedido_id:pedido.id,monto:0.10},conexion);
      await registrarMovimiento({tipo:'ingreso',pedido_id:pedido.id,monto:0.20},conexion);
      await assert.rejects(registrarMovimiento({tipo:'ingreso',pedido_id:pedido.id,monto:0.01},conexion), /saldo/);
      const [producto] = await consulta`INSERT INTO productos (nombre,categoria,precio) VALUES ('Atajo','Prueba',100) RETURNING id`;
      const [variante] = await consulta`INSERT INTO inventario (nombre,producto_id,existencias) VALUES ('Atajo',${producto.id},10) RETURNING id`;
      const trabajo = await crearPedido({cliente_id:cliente.id,vista_previa:true,partidas:[{variante_id:variante.id,cantidad:2}]},true,null,conexion);
      await assert.rejects(avanzarPedido(trabajo.id,'listo',conexion), /Aprobá/);
      await cambiarEstado(trabajo.id,'pendiente',null,conexion);
      await assert.rejects(avanzarPedido(trabajo.id,'listo',conexion), /aprobar el diseño/);
      let [stock] = await consulta`SELECT existencias,reservado FROM inventario WHERE id = ${variante.id}`;
      assert.deepEqual(stock,{existencias:10,reservado:2});
      await consulta`UPDATE pedidos SET diseno_aprobado = true WHERE id = ${trabajo.id}`;
      const terminado = await avanzarPedido(trabajo.id,'entregado',conexion);
      assert.equal(terminado.estado,'entregado');
      [stock] = await consulta`SELECT existencias,reservado FROM inventario WHERE id = ${variante.id}`;
      assert.deepEqual(stock,{existencias:8,reservado:0});
      await assert.rejects(avanzarPedido(trabajo.id,'entregado',conexion));
      const empleado = await guardarEmpleado({nombre:'Nuevo empleado',salario:''},null,conexion);
      assert.equal(empleado.puesto,'');
      assert.equal(Number(empleado.salario),0);
      assert.equal(empleado.activo,true);
      const editado = await guardarEmpleado({telefono:'12345'},empleado.id,conexion);
      assert.equal(editado.nombre,empleado.nombre);
      assert.equal(editado.telefono,'12345');
      const [recordatorio] = await consulta`INSERT INTO recordatorios (titulo) VALUES ('Pendiente sin fecha') RETURNING fecha`;
      assert.equal(recordatorio.fecha,null);
      throw revertir;
    });
  } catch (error) { if (error !== revertir) throw error; }
  finally { await sql.end(); }
});
