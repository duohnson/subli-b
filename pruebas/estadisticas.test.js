import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { variacion } from '../src/estadisticas.js';
import { obtenerEstadisticas } from '../servidor/estadisticas.js';
import { sql } from '../servidor/base.js';

// comprobar aumentos, caidas y años sin base para no mostrar porcentajes inventados
test('La variación distingue aumentos, caídas y ausencia de ventas previas', () => {
  assert.equal(variacion(150, 100), 50);
  assert.equal(variacion(0, 100), -100);
  assert.equal(variacion(0, 0), null);
  assert.equal(variacion(100, 0), null);
});
// rechazar el año antes de consultar la base
 test('Estadísticas rechaza años fuera del rango permitido', async () => {
  for (const anio of ['texto', 1999, 2101, 2026.5]) await assert.rejects(obtenerEstadisticas(anio));
});
// activar esta prueba solo con una base de desarrollo configurada
// revertir los datos al terminar para no dejar ventas falsas en el panel
 test('PostgreSQL calcula las estadísticas sin duplicar ventas ni incluir cancelaciones', { skip: process.env.PROBAR_POSTGRES !== '1' }, async () => {
  const revertir = Error('revertir datos de prueba');
  try {
    await sql.begin(async consulta => {
      const [existentes] = await consulta`SELECT count(*)::integer AS cantidad FROM pedidos WHERE creado >= '2089-01-01' AND creado < '2092-01-01'`;
      assert.equal(existentes.cantidad, 0, 'Los años de la prueba deben estar vacíos');
      const [cliente] = await consulta`INSERT INTO clientes (nombre, correo) VALUES ('Prueba estadística', ${randomUUID() + '@example.test'}) RETURNING id`;
      const [producto] = await consulta`INSERT INTO productos (nombre, categoria, precio) VALUES ('Artículo de prueba', 'Prueba estadística', 100) RETURNING id`;
      const [variante] = await consulta`INSERT INTO inventario (producto_id, nombre) VALUES (${producto.id}, 'Variante de prueba') RETURNING id`;
      const escenarios = [
        ['2089-01-15 12:00:00-06', 'entregado', 400, 200, 4],
        ['2090-01-15 12:00:00-06', 'pendiente', 600, 200, 6],
        ['2090-02-15 12:00:00-06', 'listo', 200, 100, 2],
        ['2090-03-15 12:00:00-06', 'cancelado', 5000, 100, 50],
        ['2090-03-16 12:00:00-06', 'cotizacion', 7000, 100, 70],
        ['2091-01-01 00:00:00-06', 'entregado', 900, 100, 9]
      ];
      for (const [creado, estado, total, costo, cantidad] of escenarios) {
        const [pedido] = await consulta`INSERT INTO pedidos (codigo, cliente_id, creado, estado, total, costo) VALUES (${randomUUID()}, ${cliente.id}, ${creado}, ${estado}, ${total}, ${costo}) RETURNING id`;
        await consulta`INSERT INTO partidas (pedido_id, variante_id, cantidad, precio, costo_unitario) VALUES (${pedido.id}, ${variante.id}, ${cantidad}, 100, ${costo / cantidad})`;
      }
      await consulta`INSERT INTO movimientos (tipo, concepto, monto, comision, medio, fecha) VALUES ('ingreso', 'Prueba estadística', 300, 10, 'efectivo', '2090-02-01'), ('gasto', 'Prueba estadística', 80, 0, 'efectivo', '2090-02-02')`;
      const datos = await obtenerEstadisticas(2090, consulta);
      assert.deepEqual(datos.resumen, { ventas: 800, anterior: 400, costo: 300, pedidos: 2 });
      assert.equal(datos.meses.length, 12);
      assert.deepEqual(datos.meses[0], { mes: 1, ventas: 600, anterior: 400, costo: 200, pedidos: 1 });
      assert.equal(datos.meses[2].ventas, 0);
      assert.equal(datos.clientes, 1);
      assert.equal(Number(datos.productos[0].unidades), 8);
      assert.equal(Number(datos.categorias[0].ventas), 800);
      assert.equal(Number(datos.categorias[0].anterior), 400);
      assert.equal(Number(datos.efectivo.cobros) - Number(datos.efectivo.gastos) - Number(datos.efectivo.comisiones), 210);
      // comprobar un año sin registros para cubrir el estado vacio de los graficos
      const vacio = await obtenerEstadisticas(2088, consulta);
      assert.equal(vacio.resumen.ventas, 0);
      assert.equal(vacio.productos.length, 0);
      throw revertir;
    });
  } catch (error) {
    if (error !== revertir) throw error;
  } finally {
    await sql.end();
  }
});
