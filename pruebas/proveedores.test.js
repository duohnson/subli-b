import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import { sql } from '../servidor/base.js';

test('Proveedores: correo opcional y asignación masiva atómica', { skip: process.env.PROBAR_POSTGRES !== '1' }, async () => {
  const puerto = 35000 + Math.floor(Math.random() * 20000);
  const token = randomBytes(24).toString('hex');
  const inventario = [];
  let usuario, proveedor, servidor;
  try {
    [usuario] = await sql`INSERT INTO usuarios (nombre, correo, clave, rol) VALUES ('Prueba lotes', ${token + '@example.test'}, 'sin-acceso', 'administrador') RETURNING id`;
    await sql`INSERT INTO sesiones (token, usuario_id, vence) VALUES (${createHash('sha256').update(token).digest('hex')}, ${usuario.id}, now() + interval '10 minutes')`;
    inventario.push(...await sql`INSERT INTO inventario ${sql(Array.from({length: 40}, (_, i) => ({nombre: `Material de prueba ${i}`})))} RETURNING id`);
    servidor = spawn(process.execPath, ['servidor.js'], { env: {...process.env, PUERTO: String(puerto), URL_PUBLICA: `http://localhost:${puerto}`, SMTP_HOST: '', CORREO_ADMIN: ''}, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('No inició el servidor')), 10000);
      servidor.stdout.on('data', data => { if (data.toString().includes('disponible')) { clearTimeout(timer); resolve(); } });
      servidor.once('exit', () => { clearTimeout(timer); reject(Error('El servidor terminó antes de iniciar')); });
    });
    async function api(ruta, datos, metodo = 'POST') {
      const respuesta = await fetch(`http://localhost:${puerto}/api/privado/${ruta}`, { method: metodo, headers: {Cookie: `sesion=${token}`, 'Content-Type': 'application/json'}, ...(datos === undefined ? {} : {body: JSON.stringify(datos)}) });
      return {status: respuesta.status, body: await respuesta.json()};
    }
    const ids = inventario.map(item => item.id);
    let resultado = await api('proveedores', {nombre:'Proveedor de prueba', inventario_ids:[...ids, ids[0]]});
    assert.equal(resultado.status, 200, JSON.stringify(resultado.body));
    proveedor = resultado.body;
    assert.equal(proveedor.correo, null);
    assert.deepEqual(proveedor.inventario_ids, ids);
    for (const correo of ['', '   ', null]) {
      resultado = await api(`proveedores/${proveedor.id}`, {correo}, 'PATCH');
      assert.equal(resultado.status, 200);
      assert.equal(resultado.body.correo, null);
      assert.deepEqual(resultado.body.inventario_ids, ids);
    }
    resultado = await api(`proveedores/${proveedor.id}`, {correo:' PROVEEDOR@EXAMPLE.TEST '}, 'PATCH');
    assert.equal(resultado.body.correo, 'proveedor@example.test');
    resultado = await api(`proveedores/${proveedor.id}`, {correo:'incorrecto'}, 'PATCH');
    assert.equal(resultado.status, 400);
    resultado = await api(`proveedores/${proveedor.id}`, {nombre:'No guardar', inventario_ids:[ids[0], 999999999]}, 'PATCH');
    assert.equal(resultado.status, 400);
    const [actual] = await sql`SELECT nombre FROM proveedores WHERE id = ${proveedor.id}`;
    assert.equal(actual.nombre, 'Proveedor de prueba');
    assert.equal((await sql`SELECT * FROM proveedor_inventario WHERE proveedor_id = ${proveedor.id}`).length, 40);
    resultado = await api(`proveedores/${proveedor.id}`, {nombre:'Proveedor de prueba', inventario_ids:[]}, 'PATCH');
    assert.deepEqual(resultado.body.inventario_ids, []);
    resultado = await api('compras', {proveedor_id:proveedor.id, inventario_id:ids[0], cantidad:2, costo_unitario:100});
    assert.equal(resultado.status, 201, JSON.stringify(resultado.body));
    const vinculos = await sql`SELECT inventario_id FROM proveedor_inventario WHERE proveedor_id = ${proveedor.id}`;
    assert.deepEqual([...vinculos], [{inventario_id:ids[0]}]);
    resultado = await api('compras', {proveedor_id:proveedor.id, inventario_id:ids[1], cantidad:0, costo_unitario:100});
    assert.equal(resultado.status, 400);
    assert.equal((await sql`SELECT * FROM proveedor_inventario WHERE proveedor_id = ${proveedor.id}`).length, 1);
  } finally {
    if (servidor && servidor.exitCode === null) { const salida = once(servidor, 'exit'); servidor.kill('SIGTERM'); await salida; }
    if (proveedor) await sql`DELETE FROM compras WHERE proveedor_id = ${proveedor.id}`;
    if (proveedor) await sql`DELETE FROM proveedores WHERE id = ${proveedor.id}`;
    if (inventario.length) await sql`DELETE FROM inventario WHERE id IN ${sql(inventario.map(item => item.id))}`;
    if (usuario) { await sql`DELETE FROM sesiones WHERE usuario_id = ${usuario.id}`; await sql`DELETE FROM usuarios WHERE id = ${usuario.id}`; }
    await sql.end();
  }
});
