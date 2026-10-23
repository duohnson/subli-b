import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearDocumento, prepararDocumentoIndependiente } from '../servidor/documentos.js';
import { sql } from '../servidor/base.js';

const partidas = [{ nombre: 'Diseño', cantidad: 2, precio: 1250.25 }, { nombre: 'Impresión', cantidad: 3, precio: 100 }];
test('Documentos independientes calculan el total y validan partidas sin exigir contacto', () => {
  const resultado = prepararDocumentoIndependiente({tipo: 'proforma', partidas});
  assert.equal(resultado.total, 2800.5);
  assert.equal(resultado.detalle.cliente, 'Cliente general');
  assert.equal(resultado.detalle.correo, null);
  for (const invalidas of [[], [null], [{nombre:'', cantidad:1, precio:1}], [{nombre:'X', cantidad:0, precio:1}], [{nombre:'X', cantidad:1.5, precio:1}], [{nombre:'X', cantidad:1, precio:-1}], [{nombre:'X', cantidad:999999999, precio:999999999}], Array(31).fill(partidas[0])]) {
    assert.throws(() => prepararDocumentoIndependiente({partidas:invalidas}));
  }
  assert.throws(() => prepararDocumentoIndependiente({partidas, correo:'incorrecto'}));
});
test('Facturas y comprobantes exigen pedido antes de acceder a la base', async () => {
  for (const tipo of ['factura','comprobante','desconocido']) await assert.rejects(crearDocumento({tipo, partidas}, {begin() { assert.fail('No debe consultar la base'); }}));
});
test('Documentos: creación independiente, vínculo opcional y controles de facturas', {skip: process.env.PROBAR_POSTGRES !== '1'}, async () => {
  const revertir = Error('revertir');
  try {
    await sql.begin(async consulta => {
      const conexion = {begin: fn => consulta.savepoint(fn)};
      const antes = await consulta`SELECT (SELECT count(*) FROM pedidos) AS pedidos, (SELECT count(*) FROM clientes) AS clientes, (SELECT count(*) FROM movimientos) AS movimientos`;
      for (const tipo of ['cotizacion','proforma','recibo','nota_credito']) {
        const documento = await crearDocumento({tipo, partidas}, conexion);
        assert.equal(documento.pedido_id, null);
        assert.equal(Number(documento.total), 2800.5);
        assert.equal(documento.detalle.pagado, tipo === 'recibo' ? 2800.5 : 0);
      }
      assert.deepEqual(await consulta`SELECT (SELECT count(*) FROM pedidos) AS pedidos, (SELECT count(*) FROM clientes) AS clientes, (SELECT count(*) FROM movimientos) AS movimientos`, antes);
      await assert.rejects(consulta.savepoint(c => c`INSERT INTO documentos (tipo, total, detalle) VALUES ('factura', 1, '{}'::jsonb)`), /documentos_pedido_obligatorio/);
      await assert.rejects(crearDocumento({tipo:'proforma', pedido_id:999999999}, conexion), /Pedido no encontrado/);
      const [cliente] = await consulta`INSERT INTO clientes (nombre) VALUES ('Documento prueba') RETURNING id`;
      const [pedido] = await consulta`INSERT INTO pedidos (codigo, cliente_id, total) VALUES (${randomUUID()}, ${cliente.id}, 2800.50) RETURNING id`;
      const proforma = await crearDocumento({tipo:'proforma', pedido_id:pedido.id}, conexion);
      assert.equal(proforma.pedido_id, pedido.id);
      await assert.rejects(crearDocumento({tipo:'factura', pedido_id:pedido.id}, conexion), /Aprobá/);
      await assert.rejects(crearDocumento({tipo:'comprobante', pedido_id:pedido.id}, conexion), /No hay pagos/);
      await assert.rejects(crearDocumento({tipo:'nota_credito', pedido_id:pedido.id}, conexion), /factura/);
      await consulta`UPDATE pedidos SET estado = 'pendiente' WHERE id = ${pedido.id}`;
      await crearDocumento({tipo:'factura', pedido_id:pedido.id}, conexion);
      await assert.rejects(crearDocumento({tipo:'factura', pedido_id:pedido.id}, conexion), /ya tiene/);
      await consulta`INSERT INTO movimientos (tipo, concepto, monto, medio, pedido_id) VALUES ('ingreso','Adelanto',100,'efectivo',${pedido.id})`;
      const comprobante = await crearDocumento({tipo:'comprobante', pedido_id:pedido.id}, conexion);
      assert.equal(Number(comprobante.total), 100);
      throw revertir;
    });
  } catch (error) { if (error !== revertir) throw error; }
  finally { await sql.end(); }
});
