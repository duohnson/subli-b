import { createInterface } from 'node:readline/promises';
import { sql, verificarBase } from '../../servidor/base.js';
import { guardarClave, correo, exigir } from '../../servidor/utilidades.js';

const entrada = createInterface({ input: process.stdin, output: process.stdout });
try {
  await verificarBase();
  const nombre = (await entrada.question('Nombre: ')).trim();
  const email = correo(await entrada.question('Correo: '));
  const clave = process.env.CLAVE_USUARIO;
  exigir(nombre, 'El nombre es obligatorio');
  exigir(clave, 'Definí CLAVE_USUARIO antes de ejecutar este comando');
  await sql`INSERT INTO usuarios (nombre, correo, clave, rol) VALUES (${nombre}, ${email}, ${guardarClave(clave)}, 'administrador')`;
  console.log('Usuario administrador creado');
} catch (error) {
  console.error(error.code === '23505' ? 'Ese correo ya está registrado' : error.message);
  process.exitCode = 1;
} finally {
  entrada.close();
  await sql.end();
}
