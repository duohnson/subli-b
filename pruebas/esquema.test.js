import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { sql } from '../servidor/base.js';

const sinTransaccion = contenido => contenido.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');

test('El esquema nuevo y las migraciones dejan las mismas columnas', { skip: process.env.PROBAR_POSTGRES !== '1' }, async () => {
  const esquema = 'prueba_' + randomUUID().replaceAll('-', '');
  const revertir = Error('revertir esquema de prueba');
  try {
    await sql.begin(async consulta => {
      await consulta`CREATE SCHEMA ${consulta(esquema)}`;
      await consulta`SELECT set_config('search_path', ${esquema}, true)`;
      await consulta.unsafe(sinTransaccion(await readFile('documentos/base_de_datos/schema.sql', 'utf8')));
      const columnas = () => consulta`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ${esquema} ORDER BY table_name, ordinal_position`;
      const iniciales = await columnas();
      await consulta`ALTER TABLE productos DROP COLUMN imagenes`;
      await consulta`ALTER TABLE clientes ALTER COLUMN correo SET NOT NULL`;
      await consulta`ALTER TABLE proveedores ALTER COLUMN correo SET NOT NULL`;
      await consulta`ALTER TABLE proveedores ALTER COLUMN correo SET DEFAULT ''`;
      await consulta`DROP TABLE pagos_salarios`;
      await consulta`DROP TABLE empleados`;
      await consulta`ALTER TABLE pedidos DROP COLUMN vendedor_id`;
      for (const [tabla, campos] of [['inventario', ['existencias', 'reservado', 'minimo']], ['compras', ['cantidad']], ['reservas', ['cantidad']], ['recetas', ['cantidad']]]) {
        for (const campo of campos) await consulta`ALTER TABLE ${consulta(tabla)} ALTER COLUMN ${consulta(campo)} TYPE numeric(12,3)`;
      }
      await consulta`CREATE TABLE configuracion (clave text PRIMARY KEY, valor text)`;
      await consulta`INSERT INTO inventario (nombre, existencias, reservado, minimo) VALUES ('Prueba de migración', 7, 2, 1)`;
      const migracion = sinTransaccion(await readFile('migraciones/002-cantidades-enteras.sql', 'utf8'));
      await assert.rejects(consulta.savepoint(async transaccion => {
        await transaccion`UPDATE inventario SET existencias = 7.5`;
        await transaccion.unsafe(migracion);
      }), /cantidades fraccionarias/);
      await consulta.unsafe(sinTransaccion(await readFile('migraciones/001-retirar-textos.sql', 'utf8')));
      await consulta.unsafe(migracion);
      await consulta.unsafe(sinTransaccion(await readFile('migraciones/003-empleados.sql', 'utf8')));
      await consulta.unsafe(sinTransaccion(await readFile('migraciones/005-correo-opcional.sql', 'utf8')));
      await consulta.unsafe(sinTransaccion(await readFile('migraciones/006-imagenes-productos.sql', 'utf8')));
      await consulta`INSERT INTO proveedores (nombre, correo) VALUES ('Sin correo', '   '), ('Con correo', 'proveedor@example.test')`;
      await consulta`INSERT INTO empleados (nombre, puesto, correo) VALUES ('Sin correo', 'Vendedor', '')`;
      await consulta`INSERT INTO clientes (nombre, correo) VALUES ('Sin correo', ' ')`;
      await consulta.unsafe(sinTransaccion(await readFile('migraciones/007-correos-contacto-opcionales.sql', 'utf8')));
      await consulta.unsafe(sinTransaccion(await readFile('migraciones/007-correos-contacto-opcionales.sql', 'utf8')));
      assert.deepEqual(await columnas(), iniciales);
      for (const tabla of ['clientes', 'proveedores', 'empleados']) {
        const [contacto] = await consulta`SELECT correo FROM ${consulta(tabla)} WHERE nombre = 'Sin correo'`;
        assert.equal(contacto.correo, null);
      }
      const [conCorreo] = await consulta`SELECT correo FROM proveedores WHERE nombre = 'Con correo'`;
      assert.equal(conCorreo.correo, 'proveedor@example.test');
      const [fila] = await consulta`SELECT existencias, reservado, minimo FROM inventario`;
      assert.deepEqual(fila, { existencias: 7, reservado: 2, minimo: 1 });
      throw revertir;
    });
  } catch (error) { if (error !== revertir) throw error; }
  finally { await sql.end(); }
});
