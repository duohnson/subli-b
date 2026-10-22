import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL || 'postgres://localhost/subli_b', { max: 10, connect_timeout: 5, connection: { TimeZone: 'America/Costa_Rica' } });

// revisar la conexion antes de aceptar pedidos, sin crear ninguna base automaticamente
export async function verificarBase() {
  if (!process.env.DATABASE_URL) throw Error('No se ubicó la base de datos');
  try {
    await sql`SELECT 1`;
  } catch (error) {
    if (error.code === '3D000' || ['ECONNREFUSED', 'ENOTFOUND'].includes(error.code)) throw Error('No se ubicó la base de datos');
    throw Error('No se pudo conectar con PostgreSQL. Revisá las credenciales y la conexión.');
  }
  const [tabla] = await sql`SELECT to_regclass('public.usuarios') AS nombre`;
  if (!tabla.nombre) throw Error('La base de datos no tiene el esquema. Importá schema.sql manualmente.');
}
