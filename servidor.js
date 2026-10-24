import { registrarMovimiento, registrarCompras } from './servidor/operaciones.js';
import { crearDocumento } from './servidor/documentos.js';
import { guardarEmpleado, crearUsuarioEmpleado, pagarSalario, ventasPorUsuario } from './servidor/empleados.js';
import express from 'express';
import { obtenerEstadisticas } from './servidor/estadisticas.js';
import multer from 'multer';
import QRCode from 'qrcode';
import { generarDocumento, generarReporte } from './servidor/pdf.js';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { sql, verificarBase } from './servidor/base.js';
import { exigir, texto, numero, numeroOpcional, entero, correo, correoOpcional, fecha, guardarClave, comprobarClave, calcularPrecio } from './servidor/utilidades.js';
import { crearPedido, cambiarEstado, avanzarPedido, listarPedidos, editarPedidoCliente, aprobarDiseno } from './servidor/pedidos.js';
import { procesarNotificaciones } from './servidor/notificaciones.js';

const carpeta = path.dirname(fileURLToPath(import.meta.url));
const aplicacion = express();
const intentos = new Map();
const subir = multer({ dest: path.join(carpeta, 'archivos'), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const origen = new URL(process.env.URL_PUBLICA || 'http://localhost:3000').origin;
// guardar una huella del token de sesion en vez del token q lleva el navegador
const resumen = valor => createHash('sha256').update(valor).digest('hex');
const opcionesCookie = { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SEGURA === 'true', path: '/' };
aplicacion.disable('x-powered-by');
aplicacion.use((peticion, respuesta, siguiente) => {
  respuesta.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
  if (peticion.path.startsWith('/api/')) respuesta.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(peticion.method) && peticion.get('origin') && peticion.get('origin') !== origen) return respuesta.status(403).json({ error: 'Origen no permitido' });
  siguiente();
});
aplicacion.use(express.json({ limit: '128kb' }));
// publicar solo los recursos del sitio, no el archivo de entorno ni la carpeta de la base
aplicacion.use('/src', express.static(path.join(carpeta, 'src'), {
  setHeaders(respuesta, archivo) {
    // html y codigo deben actualizarse juntos, incluso detras de cdn
    if (/\.(css|js)$/.test(archivo)) respuesta.set({
      'Cache-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store'
    });
  }
}));
aplicacion.get('/', (peticion, respuesta) => respuesta.sendFile(path.join(carpeta, 'index.html'), { headers: { 'Cache-Control': 'no-store' } }));
aplicacion.get('/catalogo', (peticion, respuesta) => respuesta.sendFile(path.join(carpeta, 'catalogo.html'), { headers: { 'Cache-Control': 'no-store' } }));
aplicacion.get('/administracion', (peticion, respuesta) => respuesta.sendFile(path.join(carpeta, 'administracion.html'), { headers: { 'Cache-Control': 'no-store' } }));
aplicacion.get('/administracion.html', (peticion, respuesta) => respuesta.sendFile(path.join(carpeta, 'administracion.html'), { headers: { 'Cache-Control': 'no-store' } }));

function limitar(peticion, categoria, maximo) {
  const clave = `${categoria}-${peticion.ip}`;
  const ahora = Date.now();
  for (const [llave, valor] of intentos) if (valor.vence < ahora) intentos.delete(llave);
  const registro = intentos.get(clave) || { cantidad: 0, vence: ahora + 15 * 60000 };
  registro.cantidad++;
  intentos.set(clave, registro);
  exigir(registro.cantidad <= maximo, 'Demasiados intentos. Intentá de nuevo en 15 minutos', 429);
}
async function autenticar(peticion, respuesta, siguiente) {
  const token = peticion.headers.cookie?.split(';').map(parte => parte.trim()).find(parte => parte.startsWith('sesion='))?.slice(7);
  exigir(token, 'Ingresá con tu usuario y contraseña', 401);
  const [usuario] = await sql`SELECT u.id, u.nombre, u.correo, u.rol FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ${resumen(token)} AND s.vence > now() AND u.activo`;
  exigir(usuario, 'La sesión venció. Volvé a ingresar', 401);
  peticion.usuario = usuario;
  peticion.token = resumen(token);
  siguiente();
}
function administrador(peticion, respuesta, siguiente) {
  exigir(peticion.usuario.rol === 'administrador', 'Esta función requiere acceso de administración', 403);
  siguiente();
}

aplicacion.post('/api/ingresar', async (peticion, respuesta) => {
  limitar(peticion, 'ingresar', 15);
  const [usuario] = await sql`SELECT * FROM usuarios WHERE correo = ${correo(peticion.body.correo)} AND activo`;
  exigir(usuario && comprobarClave(peticion.body.clave, usuario.clave), 'Correo o contraseña incorrectos', 401);
  const token = randomBytes(32).toString('hex');
  await sql`INSERT INTO sesiones (token, usuario_id, vence) VALUES (${resumen(token)}, ${usuario.id}, now() + interval '8 hours')`;
  respuesta.cookie('sesion', token, { ...opcionesCookie, maxAge: 8 * 60 * 60 * 1000 }).json({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
});
aplicacion.post('/api/salir', autenticar, async (peticion, respuesta) => {
  await sql`DELETE FROM sesiones WHERE token = ${peticion.token}`;
  respuesta.clearCookie('sesion', opcionesCookie).json({ mensaje: 'Sesión cerrada' });
});
aplicacion.get('/api/catalogo', async (peticion, respuesta) => {
  const productos = await sql`SELECT p.id, p.nombre, p.categoria, p.descripcion, p.imagen, p.imagenes, p.precio, p.promocion, p.personalizable, COALESCE(jsonb_agg(jsonb_build_object('id', i.id, 'color', i.color, 'talla', i.talla, 'disponible', i.existencias - i.reservado)) FILTER (WHERE i.id IS NOT NULL), '[]') AS variantes FROM productos p LEFT JOIN inventario i ON i.producto_id = p.id WHERE p.activo GROUP BY p.id ORDER BY p.nombre`;
  respuesta.json(productos);
});
aplicacion.get('/api/contenidos', async (peticion, respuesta) => respuesta.json(await sql`SELECT * FROM contenidos WHERE activo ORDER BY orden, id`));
aplicacion.get('/media/:id', async (peticion, respuesta) => {
  const [medio] = await sql`SELECT * FROM medios WHERE id = ${entero(peticion.params.id)}`;
  exigir(medio, 'Imagen no encontrada', 404);
  respuesta.type(medio.tipo).sendFile(path.join(carpeta, 'archivos', medio.ruta));
});
aplicacion.post('/api/solicitudes', async (peticion, respuesta) => {
  limitar(peticion, 'solicitar', 20);
  const pedido = await crearPedido(peticion.body);
  respuesta.status(201).json({ id: pedido.id, codigo: pedido.codigo, total: pedido.total });
});
aplicacion.get('/api/seguimiento/:codigo', async (peticion, respuesta) => {
  limitar(peticion, 'seguimiento', 150);
  const [pedido] = await sql`SELECT p.id, p.estado, p.total, p.instrucciones, p.fecha_prometida, p.vista_previa, p.diseno_aprobado, COALESCE(sum(m.monto), 0) AS pagado FROM pedidos p LEFT JOIN movimientos m ON m.pedido_id = p.id WHERE p.codigo = ${texto(peticion.params.codigo)} GROUP BY p.id`;
  exigir(pedido, 'No se encontró ese pedido', 404);
  const archivos = await sql`SELECT id, nombre, es_previa FROM archivos WHERE pedido_id = ${pedido.id}`;
  const partidas = await sql`SELECT pa.id, pa.cantidad, pa.precio, pa.nombre_personalizado, pr.nombre, i.color, i.talla FROM partidas pa JOIN inventario i ON i.id = pa.variante_id JOIN productos pr ON pr.id = i.producto_id WHERE pa.pedido_id = ${pedido.id} ORDER BY pa.id`;
  respuesta.json({ ...pedido, archivos, partidas, enlace: `${origen}/#seguimiento=${encodeURIComponent(peticion.params.codigo)}` });
});
aplicacion.patch('/api/seguimiento/:codigo', async (peticion, respuesta) => {
  limitar(peticion, 'editar-pedido', 30);
  respuesta.json(await editarPedidoCliente(texto(peticion.params.codigo), peticion.body));
});
aplicacion.post('/api/seguimiento/:codigo/confirmar', async (peticion, respuesta) => {
  limitar(peticion, 'confirmar-pedido', 30);
  const codigo = texto(peticion.params.codigo);
  const [pedido] = await sql`SELECT id FROM pedidos WHERE codigo = ${codigo}`;
  exigir(pedido, 'Pedido no encontrado', 404);
  await cambiarEstado(pedido.id, 'pendiente', codigo);
  respuesta.json({ mensaje: 'Pedido confirmado' });
});
aplicacion.post('/api/seguimiento/:codigo/aprobar', async (peticion, respuesta) => {
  limitar(peticion, 'aprobar-diseno', 30);
  respuesta.json(await aprobarDiseno(texto(peticion.params.codigo)));
});
async function guardarArchivo(peticion, respuesta) {
  try {
    exigir(peticion.file, 'Seleccioná una imagen PNG o JPEG');
    const contenido = await readFile(peticion.file.path);
    // revisar la firma del archivo, no confiar solo en el nombre o la extension
    const png = contenido.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = contenido[0] === 255 && contenido[1] === 216 && contenido[2] === 255;
    exigir(png || jpg, 'Solo se admiten imágenes PNG o JPEG de hasta 5 MB');
    const pedido = await sql.begin(async consulta => {
      const [pedido] = peticion.usuario ? await consulta`SELECT * FROM pedidos WHERE id = ${entero(peticion.params.id)} FOR UPDATE` : await consulta`SELECT * FROM pedidos WHERE codigo = ${texto(peticion.params.codigo)} FOR UPDATE`;
      exigir(pedido, 'Pedido no encontrado', 404);
      exigir(['cotizacion','pendiente'].includes(pedido.estado), 'El pedido ya no permite cambiar diseños');
      const [cuenta] = await consulta`SELECT count(*)::integer AS cantidad FROM archivos WHERE pedido_id = ${pedido.id}`;
      exigir(cuenta.cantidad < 20, 'El pedido alcanzó el límite de 20 archivos');
      const previa = Boolean(peticion.usuario);
      await consulta`INSERT INTO archivos (pedido_id, nombre, ruta, tipo, es_previa) VALUES (${pedido.id}, ${texto(peticion.file.originalname, 150)}, ${peticion.file.filename}, ${png ? 'image/png' : 'image/jpeg'}, ${previa})`;
      await consulta`UPDATE pedidos SET vista_previa = vista_previa OR ${previa}, diseno_aprobado = false WHERE id = ${pedido.id}`;
      return pedido;
    });
    respuesta.status(201).json({ mensaje: 'Imagen guardada', pedido: pedido.id });
  } catch (error) {
    if (peticion.file) await unlink(peticion.file.path).catch(() => {});
    throw error;
  }
}
aplicacion.post('/api/seguimiento/:codigo/archivos', (peticion, respuesta, siguiente) => { limitar(peticion, 'archivos', 30); siguiente(); }, subir.single('imagen'), guardarArchivo);
aplicacion.get('/api/seguimiento/:codigo/archivos/:id', async (peticion, respuesta) => {
  const [archivo] = await sql`SELECT a.* FROM archivos a JOIN pedidos p ON p.id = a.pedido_id WHERE p.codigo = ${texto(peticion.params.codigo)} AND a.id = ${entero(peticion.params.id)}`;
  exigir(archivo, 'Archivo no encontrado', 404);
  respuesta.type(archivo.tipo).sendFile(path.join(carpeta, 'archivos', archivo.ruta));
});

// exigir sesion en todas las rutas privadas declaradas a partir de este punto
aplicacion.use('/api/privado', autenticar);
aplicacion.get('/api/privado/sesion', (peticion, respuesta) => respuesta.json(peticion.usuario));
aplicacion.get('/api/privado/pedidos', async (peticion, respuesta) => respuesta.json(await listarPedidos()));
aplicacion.get('/api/privado/pedidos/:id/detalle', async (peticion, respuesta) => {
  const partidas = await sql`SELECT pa.*, i.nombre, i.color, i.talla FROM partidas pa JOIN inventario i ON i.id = pa.variante_id WHERE pa.pedido_id = ${entero(peticion.params.id)}`;
  respuesta.json(partidas);
});
aplicacion.post('/api/privado/pedidos', async (peticion, respuesta) => respuesta.status(201).json(await crearPedido(peticion.body, true, peticion.usuario.id)));
aplicacion.patch('/api/privado/pedidos/:id', async (peticion, respuesta) => {
  const id = entero(peticion.params.id);
  if (peticion.body.estado) return respuesta.json(await cambiarEstado(id, peticion.body.estado));
  const datos = {};
  for (const campo of ['fecha_prometida','fecha_pago']) if (campo in peticion.body) datos[campo] = fecha(peticion.body[campo]);
  if ('responsable_id' in peticion.body) datos.responsable_id = peticion.body.responsable_id ? entero(peticion.body.responsable_id) : null;
  if ('instrucciones' in peticion.body) datos.instrucciones = texto(peticion.body.instrucciones, 3000);
  exigir(Object.keys(datos).length, 'No hay cambios para guardar');
  const [pedido] = await sql`UPDATE pedidos SET ${sql(datos)} WHERE id = ${id} RETURNING *`;
  exigir(pedido, 'Pedido no encontrado', 404);
  respuesta.json(pedido);
});
aplicacion.post('/api/privado/pedidos/:id/avanzar', async (peticion, respuesta) => {
  respuesta.json(await avanzarPedido(entero(peticion.params.id), texto(peticion.body.estado)));
});
aplicacion.post('/api/privado/pedidos/:id/aprobar-diseno', (peticion, respuesta, siguiente) => { administrador(peticion, respuesta, siguiente); }, async (peticion, respuesta) => {
  respuesta.json(await aprobarDiseno(entero(peticion.params.id), true));
});
aplicacion.post('/api/privado/pedidos/:id/repetir', async (peticion, respuesta) => {
  const [anterior] = await sql`SELECT * FROM pedidos WHERE id = ${entero(peticion.params.id)}`;
  exigir(anterior, 'Pedido no encontrado', 404);
  const partidas = await sql`SELECT * FROM partidas WHERE pedido_id = ${anterior.id}`;
  const pedido = await crearPedido({ ...anterior, fecha_prometida: null, partidas }, true, peticion.usuario.id);
  await sql`INSERT INTO archivos (pedido_id, nombre, ruta, tipo, es_previa) SELECT ${pedido.id}, nombre, ruta, tipo, es_previa FROM archivos WHERE pedido_id = ${anterior.id}`;
  respuesta.status(201).json(pedido);
});
aplicacion.post('/api/privado/pedidos/:id/archivos', subir.single('imagen'), guardarArchivo);
aplicacion.get('/api/privado/pedidos/:id/qr', async (peticion, respuesta) => {
  const [pedido] = await sql`SELECT codigo FROM pedidos WHERE id = ${entero(peticion.params.id)}`;
  exigir(pedido, 'Pedido no encontrado', 404);
  respuesta.type('png').send(await QRCode.toBuffer(`${origen}/#seguimiento=${pedido.codigo}`));
});
aplicacion.get('/api/privado/disenos', async (peticion, respuesta) => respuesta.json(await sql`SELECT a.id, a.nombre, a.pedido_id, a.es_previa, c.nombre AS cliente, p.codigo, string_agg(DISTINCT pr.nombre, ', ') AS productos FROM archivos a JOIN pedidos p ON p.id = a.pedido_id JOIN clientes c ON c.id = p.cliente_id JOIN partidas pa ON pa.pedido_id = p.id JOIN inventario i ON i.id = pa.variante_id JOIN productos pr ON pr.id = i.producto_id GROUP BY a.id, c.id, p.id ORDER BY a.creado DESC`));
aplicacion.get('/api/privado/responsables', async (peticion, respuesta) => respuesta.json(await sql`SELECT id, nombre FROM usuarios WHERE activo ORDER BY nombre`));
aplicacion.get('/api/privado/misventas', async (peticion, respuesta) => {
  const desde = fecha(peticion.query.desde);
  const hasta = fecha(peticion.query.hasta);
  exigir(desde && hasta && desde <= hasta, 'Elegí un rango de fechas válido');
  respuesta.json(await sql`SELECT p.id, p.creado, p.estado, p.total, c.nombre AS cliente FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.vendedor_id = ${peticion.usuario.id} AND p.estado NOT IN ('cotizacion','cancelado') AND p.creado::date BETWEEN ${desde} AND ${hasta} ORDER BY p.creado DESC`);
});
aplicacion.get('/api/privado/variantes', async (peticion, respuesta) => respuesta.json(await sql`SELECT i.id, p.nombre, i.color, i.talla FROM inventario i JOIN productos p ON p.id = i.producto_id WHERE p.activo ORDER BY p.nombre`));
aplicacion.get('/api/privado/clientes', async (peticion, respuesta, siguiente) => {
  if (peticion.usuario.rol === 'administrador') return siguiente();
  respuesta.json(await sql`SELECT id, nombre, correo, telefono, direccion FROM clientes ORDER BY nombre`);
});
// pedir rol administrador para las rutas q siguen, ademas de la sesion ya validada
aplicacion.use('/api/privado', (peticion, respuesta, siguiente) => {
  if (peticion.path === '/sesion') return siguiente();
  administrador(peticion, respuesta, siguiente);
});

aplicacion.get('/api/privado/empleados', async (peticion, respuesta) => respuesta.json(await sql`SELECT e.*, u.correo AS acceso, u.activo AS acceso_activo FROM empleados e LEFT JOIN usuarios u ON u.id = e.usuario_id ORDER BY e.nombre`));
aplicacion.post('/api/privado/empleados', async (peticion, respuesta) => {
  exigir(Number(peticion.body.usuario_id) !== peticion.usuario.id || peticion.body.activo !== false, 'No podés desactivar tu propio acceso');
  respuesta.status(201).json(await guardarEmpleado(peticion.body));
});
aplicacion.patch('/api/privado/empleados/:id', async (peticion, respuesta) => {
  const [empleado] = await sql`SELECT usuario_id FROM empleados WHERE id = ${entero(peticion.params.id)}`;
  exigir(empleado?.usuario_id !== peticion.usuario.id || peticion.body.activo !== false, 'No podés desactivar tu propio acceso');
  respuesta.json(await guardarEmpleado(peticion.body, entero(peticion.params.id)));
});
aplicacion.post('/api/privado/empleados/:id/usuario', async (peticion, respuesta) => respuesta.status(201).json(await crearUsuarioEmpleado(entero(peticion.params.id), peticion.body)));
aplicacion.post('/api/privado/empleados/:id/pagar', async (peticion, respuesta) => respuesta.status(201).json(await pagarSalario(entero(peticion.params.id), peticion.body, peticion.usuario.id)));
aplicacion.get('/api/privado/empleados/:id/historial', async (peticion, respuesta) => {
  const id = entero(peticion.params.id);
  const desde = fecha(peticion.query.desde);
  const hasta = fecha(peticion.query.hasta);
  exigir(desde && hasta && desde <= hasta, 'Elegí un rango de fechas válido');
  const [empleado] = await sql`SELECT * FROM empleados WHERE id = ${id}`;
  exigir(empleado, 'Empleado no encontrado', 404);
  const ventas = await sql`SELECT id, creado, estado, total FROM pedidos WHERE vendedor_id = ${empleado.usuario_id} AND estado NOT IN ('cotizacion','cancelado') AND creado::date BETWEEN ${desde} AND ${hasta} ORDER BY creado DESC`;
  const pagos = await sql`SELECT ps.periodo, m.fecha, m.monto, m.medio, m.cuenta FROM pagos_salarios ps JOIN movimientos m ON m.id = ps.movimiento_id WHERE ps.empleado_id = ${id} AND m.fecha BETWEEN ${desde} AND ${hasta} ORDER BY m.fecha DESC`;
  respuesta.json({ empleado, ventas, pagos });
});
aplicacion.get('/api/privado/medios', async (peticion, respuesta) => respuesta.json(await sql`SELECT id, nombre, '/media/' || id AS imagen FROM medios ORDER BY id DESC`));
aplicacion.post('/api/privado/medios', subir.single('imagen'), async (peticion, respuesta) => {
  try {
    exigir(peticion.file, 'Seleccioná una imagen');
    const contenido = await readFile(peticion.file.path);
    // revisar la firma del archivo, no confiar solo en el nombre o la extension
    const png = contenido.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = contenido[0] === 255 && contenido[1] === 216 && contenido[2] === 255;
    exigir(png || jpg, 'Solo se admiten imágenes PNG o JPEG de hasta 5 MB');
    const [medio] = await sql`INSERT INTO medios (nombre, ruta, tipo) VALUES (${texto(peticion.file.originalname,150)}, ${peticion.file.filename}, ${png ? 'image/png' : 'image/jpeg'}) RETURNING id, nombre`;
    respuesta.status(201).json({ ...medio, imagen: `/media/${medio.id}` });
  } catch (error) {
    if (peticion.file) await unlink(peticion.file.path).catch(() => {});
    throw error;
  }
});
// ignorar campos ajenos a esta lista aunque alguien los mande a mano
const recursos = {
  contenidos: { seccion: texto, nombre: texto, imagen: valor => { const ruta = texto(valor); exigir(/^\/media\/\d+$/.test(ruta) || ruta.startsWith('/src/img/'), 'Seleccioná una imagen de la biblioteca'); return ruta; }, orden: valor => entero(numeroOpcional(valor), 0), activo: valor => valor === true },
  productos: { imagenes: valor => { exigir(Array.isArray(valor), 'Seleccioná las imágenes del producto'); const imagenes = [...new Set(valor.map(imagen => { exigir(typeof imagen === 'string' && (/^\/media\/\d+$/.test(imagen) || imagen.startsWith('/src/img/') || imagen.startsWith('src/img/')), 'Seleccioná imágenes de la biblioteca'); return imagen; }))]; return sql.json(imagenes); }, nombre: texto, categoria: texto, descripcion: texto, imagen: valor => { const ruta = texto(valor); exigir(!ruta || ruta.startsWith('/src/img/') || ruta.startsWith('src/img/') || /^\/media\/\d+$/.test(ruta), 'Seleccioná una imagen de la biblioteca'); return ruta; }, precio: numero, costo: numeroOpcional, promocion: texto, personalizable: valor => valor === true, activo: valor => valor === true },
  clientes: { nombre: texto, correo: correoOpcional, telefono: texto, direccion: texto, notas: texto, limite_credito: numeroOpcional },
  proveedores: { nombre: texto, correo: correoOpcional, telefono: texto, productos: texto, plazo_dias: valor => entero(numeroOpcional(valor), 0), notas: texto },
  inventario: { producto_id: valor => valor ? entero(valor) : null, nombre: texto, color: texto, talla: texto, minimo: valor => entero(numeroOpcional(valor), 0), costo: numeroOpcional },
  recetas: { variante_id: entero, material_id: entero, cantidad: entero },
  recordatorios: { titulo: texto, fecha, tipo: texto, completado: valor => valor === true }
};
for (const [tabla, campos] of Object.entries(recursos)) {
  aplicacion.get(`/api/privado/${tabla}`, async (peticion, respuesta) => {
    if (tabla === 'proveedores') {
      return respuesta.json(await sql`SELECT p.*, COALESCE(jsonb_agg(pi.inventario_id ORDER BY pi.inventario_id) FILTER (WHERE pi.inventario_id IS NOT NULL), '[]'::jsonb) AS inventario_ids, COALESCE(string_agg(DISTINCT concat_ws(' ', i.nombre, NULLIF(i.color, ''), NULLIF(i.talla, '')), ', ' ORDER BY concat_ws(' ', i.nombre, NULLIF(i.color, ''), NULLIF(i.talla, ''))) FILTER (WHERE i.id IS NOT NULL), '') AS productos_vinculados FROM proveedores p LEFT JOIN proveedor_inventario pi ON pi.proveedor_id = p.id LEFT JOIN inventario i ON i.id = pi.inventario_id GROUP BY p.id ORDER BY p.id DESC`);
    }
    if (tabla === 'recetas') return respuesta.json(await sql`SELECT r.*, v.nombre AS variante, m.nombre AS material FROM recetas r JOIN inventario v ON v.id = r.variante_id JOIN inventario m ON m.id = r.material_id ORDER BY r.id DESC`);
    respuesta.json(await sql`SELECT * FROM ${sql(tabla)} ORDER BY id DESC`);
  });
  async function guardar(peticion, respuesta) {
    const datos = {};
    for (const [campo, validar] of Object.entries(campos)) if (peticion.body[campo] !== undefined) datos[campo] = validar(peticion.body[campo]);
    if (tabla === 'inventario' && !peticion.params.id) datos.existencias = entero(numeroOpcional(peticion.body.existencias), 0);
    if (tabla === 'productos' && !peticion.params.id) { datos.categoria ||= 'General'; datos.precio ??= 0; }
    exigir(Object.keys(datos).length, 'Completá los datos');
    if ('nombre' in datos) exigir(datos.nombre, 'El nombre es obligatorio');
    if ('titulo' in datos) exigir(datos.titulo, 'El título es obligatorio');
    if (tabla === 'proveedores') {
      const ids = peticion.body.inventario_ids === undefined
        ? (peticion.params.id ? undefined : [])
        : (exigir(Array.isArray(peticion.body.inventario_ids), 'Seleccioná los materiales que vende este proveedor'), [...new Set(peticion.body.inventario_ids.map(id => entero(id)))]);
      const salida = await sql.begin(async consulta => {
        const filas = peticion.params.id
          ? await consulta`UPDATE proveedores SET ${consulta(datos)} WHERE id = ${entero(peticion.params.id)} RETURNING *`
          : await consulta`INSERT INTO proveedores ${consulta(datos)} RETURNING *`;
        exigir(filas[0], 'Registro no encontrado', 404);
        if (ids !== undefined) {
          await consulta`DELETE FROM proveedor_inventario WHERE proveedor_id = ${filas[0].id}`;
          if (ids.length) await consulta`INSERT INTO proveedor_inventario ${consulta(ids.map(inventario_id => ({ proveedor_id: filas[0].id, inventario_id })))}`;
        }
        const [proveedor] = await consulta`SELECT p.*, COALESCE(jsonb_agg(pi.inventario_id ORDER BY pi.inventario_id) FILTER (WHERE pi.inventario_id IS NOT NULL), '[]'::jsonb) AS inventario_ids, COALESCE(string_agg(DISTINCT concat_ws(' ', i.nombre, NULLIF(i.color, ''), NULLIF(i.talla, '')), ', ' ORDER BY concat_ws(' ', i.nombre, NULLIF(i.color, ''), NULLIF(i.talla, ''))) FILTER (WHERE i.id IS NOT NULL), '') AS productos_vinculados FROM proveedores p LEFT JOIN proveedor_inventario pi ON pi.proveedor_id = p.id LEFT JOIN inventario i ON i.id = pi.inventario_id WHERE p.id = ${filas[0].id} GROUP BY p.id`;
        return proveedor;
      });
      return respuesta.json(salida);
    }
    if (tabla === 'productos' && !peticion.params.id && peticion.body.crear_variante === true) {
      const producto = await sql.begin(async consulta => {
        const [producto] = await consulta`INSERT INTO productos ${consulta(datos)} RETURNING *`;
        await consulta`INSERT INTO inventario (producto_id, nombre, existencias, costo) VALUES (${producto.id}, ${producto.nombre}, ${entero(numeroOpcional(peticion.body.existencias), 0)}, ${producto.costo})`;
        return producto;
      });
      return respuesta.json(producto);
    }
    const filas = peticion.params.id ? await sql`UPDATE ${sql(tabla)} SET ${sql(datos)} WHERE id = ${entero(peticion.params.id)} RETURNING *` : await sql`INSERT INTO ${sql(tabla)} ${sql(datos)} RETURNING *`;
    exigir(filas[0], 'Registro no encontrado', 404);
    respuesta.json(filas[0]);
  }
  aplicacion.post(`/api/privado/${tabla}`, guardar);
  aplicacion.patch(`/api/privado/${tabla}/:id`, guardar);
}
async function eliminarContenido(peticion, respuesta) {
  const [contenido] = await sql`DELETE FROM contenidos WHERE id = ${entero(peticion.params.id)} RETURNING id`;
  exigir(contenido, 'Contenido no encontrado', 404);
  respuesta.json({ mensaje: 'Contenido eliminado' });
}
aplicacion.post('/api/privado/contenidos/:id/eliminar', eliminarContenido);
aplicacion.delete('/api/privado/contenidos/:id', eliminarContenido);
aplicacion.post('/api/privado/inventario/:id/ajustar', async (peticion, respuesta) => {
  const [fila] = await sql`UPDATE inventario SET existencias = ${entero(peticion.body.existencias, 0)} WHERE id = ${entero(peticion.params.id)} AND reservado <= ${entero(peticion.body.existencias, 0)} RETURNING *`;
  exigir(fila, 'La existencia no puede ser menor que las unidades reservadas');
  respuesta.json(fila);
});
aplicacion.get('/api/privado/compras', async (peticion, respuesta) => respuesta.json(await sql`SELECT c.*, p.nombre AS proveedor, i.nombre AS material, c.cantidad * c.costo_unitario AS total, COALESCE(sum(m.monto),0) AS pagado FROM compras c JOIN proveedores p ON p.id = c.proveedor_id JOIN inventario i ON i.id = c.inventario_id LEFT JOIN movimientos m ON m.compra_id = c.id GROUP BY c.id, p.id, i.id ORDER BY c.fecha DESC`));
aplicacion.post('/api/privado/compras', async (peticion, respuesta) => {
  respuesta.status(201).json(await registrarCompras(peticion.body));
});
aplicacion.post('/api/privado/compras/:id/recibir', async (peticion, respuesta) => {
  const compra = await sql.begin(async consulta => {
    const [compra] = await consulta`UPDATE compras SET recibida = true WHERE id = ${entero(peticion.params.id)} AND NOT recibida RETURNING *`;
    exigir(compra, 'La compra ya fue recibida o no existe');
    await consulta`UPDATE inventario SET existencias = existencias + ${compra.cantidad}, costo = ${compra.costo_unitario} WHERE id = ${compra.inventario_id}`;
    return compra;
  });
  respuesta.json(compra);
});
aplicacion.get('/api/privado/movimientos', async (peticion, respuesta) => respuesta.json(await sql`SELECT * FROM movimientos ORDER BY fecha DESC, id DESC`));
aplicacion.post('/api/privado/movimientos', async (peticion, respuesta) => {
  respuesta.status(201).json(await registrarMovimiento(peticion.body));
});
aplicacion.post('/api/privado/calcular', (peticion, respuesta) => respuesta.json(calcularPrecio(peticion.body)));
aplicacion.get('/api/privado/notificaciones', async (peticion, respuesta) => respuesta.json(await sql`SELECT * FROM notificaciones ORDER BY creado DESC LIMIT 200`));
aplicacion.post('/api/privado/notificaciones/:id/reintentar', async (peticion, respuesta) => {
  await sql`UPDATE notificaciones SET intentos = 0 WHERE id = ${entero(peticion.params.id)} AND enviada IS NULL`;
  respuesta.json({ mensaje: 'Se reintentará en el próximo ciclo SMTP' });
});
aplicacion.get('/api/privado/usuarios', async (peticion, respuesta) => respuesta.json(await sql`SELECT id, nombre, correo, rol, activo FROM usuarios ORDER BY nombre`));
aplicacion.post('/api/privado/usuarios', async (peticion, respuesta) => {
  const d = peticion.body;
  exigir(texto(d.nombre), 'Ingresá el nombre');
  const [usuario] = await sql`INSERT INTO usuarios (nombre, correo, clave, rol) VALUES (${texto(d.nombre)}, ${correo(d.correo)}, ${guardarClave(d.clave)}, ${texto(d.rol)}) RETURNING id, nombre, correo, rol`;
  respuesta.status(201).json(usuario);
});
aplicacion.patch('/api/privado/usuarios/:id', async (peticion, respuesta) => {
  const id = entero(peticion.params.id);
  exigir(id !== peticion.usuario.id, 'No podés desactivar tu propio usuario');
  await sql`UPDATE usuarios SET activo = ${peticion.body.activo === true} WHERE id = ${id}`;
  await sql`DELETE FROM sesiones WHERE usuario_id = ${id}`;
  respuesta.json({ mensaje: 'Usuario actualizado' });
});
aplicacion.get('/api/privado/estadisticas', async (peticion, respuesta) => {
  const anio = peticion.query.anio ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).slice(0, 4);
  // leer todo desde la misma foto de la base para q un pago nuevo no mezcle los resultados
  const datos = await sql.begin('isolation level repeatable read read only', consulta => obtenerEstadisticas(anio, consulta));
  respuesta.json(datos);
});
aplicacion.get('/api/privado/tablero', async (peticion, respuesta) => {
  const desde = fecha(peticion.query.desde) || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).slice(0, 7) + '-01';
  const hasta = fecha(peticion.query.hasta) || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  exigir(desde <= hasta, 'Elegí un rango de fechas válido');
  const [finanzas] = await sql`SELECT COALESCE(sum(monto) FILTER (WHERE tipo = 'ingreso'), 0) AS ingresos, COALESCE(sum(monto) FILTER (WHERE tipo = 'gasto'), 0) AS gastos, COALESCE(sum(comision), 0) AS comisiones, COALESCE(sum(impuesto), 0) AS impuestos FROM movimientos WHERE fecha BETWEEN ${desde} AND ${hasta}`;
  const pedidos = await listarPedidos();
  const estados = await sql`SELECT estado, count(*)::integer AS cantidad FROM pedidos GROUP BY estado`;
  const recordatorios = await sql`SELECT * FROM recordatorios WHERE NOT completado ORDER BY fecha LIMIT 30`;
  const inventario = await sql`SELECT * FROM inventario WHERE existencias > 0 AND existencias - reservado <= minimo ORDER BY nombre`;
  const meses = await sql`SELECT to_char(fecha, 'YYYY-MM') AS mes, sum(CASE WHEN tipo = 'ingreso' THEN monto - comision ELSE -monto - comision END) AS resultado FROM movimientos WHERE fecha BETWEEN ${desde} AND ${hasta} GROUP BY mes ORDER BY mes`;
  const categorias = await sql`SELECT pr.categoria, sum(pa.cantidad * pa.precio) AS ventas, sum(pa.cantidad * (pa.precio - pa.costo_unitario)) AS ganancia, sum(pa.cantidad) AS unidades FROM partidas pa JOIN pedidos p ON p.id = pa.pedido_id JOIN inventario i ON i.id = pa.variante_id JOIN productos pr ON pr.id = i.producto_id WHERE p.estado NOT IN ('cotizacion','cancelado') AND p.creado::date BETWEEN ${desde} AND ${hasta} GROUP BY pr.categoria ORDER BY ventas DESC`;
  const productos = await sql`SELECT pr.nombre, sum(pa.cantidad) AS unidades FROM partidas pa JOIN pedidos p ON p.id = pa.pedido_id JOIN inventario i ON i.id = pa.variante_id JOIN productos pr ON pr.id = i.producto_id WHERE p.estado NOT IN ('cotizacion','cancelado') AND p.creado::date BETWEEN ${desde} AND ${hasta} GROUP BY pr.id ORDER BY unidades DESC LIMIT 10`;
  const frecuentes = await sql`SELECT c.nombre, c.correo, count(*)::integer AS pedidos, sum(p.total) AS total FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.estado NOT IN ('cotizacion','cancelado') AND p.creado::date BETWEEN ${desde} AND ${hasta} GROUP BY c.nombre, c.correo ORDER BY pedidos DESC LIMIT 10`;
  const vendedores = await ventasPorUsuario(desde, hasta);
  respuesta.json({ finanzas, pedidos, estados, recordatorios, inventario, meses, categorias, productos, frecuentes, vendedores, desde, hasta });
});
aplicacion.get('/api/privado/documentos', async (peticion, respuesta) => {
  const filtro = peticion.query.pedido_id ? sql`WHERE pedido_id = ${entero(peticion.query.pedido_id)}` : sql``;
  respuesta.json(await sql`SELECT id, pedido_id, tipo, total, creado FROM documentos ${filtro} ORDER BY id DESC`);
});
aplicacion.post('/api/privado/documentos', async (peticion, respuesta) => {
  const documento = await crearDocumento(peticion.body);
  respuesta.status(201).json(documento);
});
aplicacion.get('/api/privado/documentos/:id/pdf', async (peticion, respuesta) => {
  const [fila] = await sql`SELECT * FROM documentos WHERE id = ${entero(peticion.params.id)}`;
  exigir(fila, 'Documento no encontrado', 404);
  respuesta.type('pdf').attachment(`subli-b-${fila.tipo}-${fila.id}.pdf`);
  generarDocumento(respuesta, fila);
});
aplicacion.get('/api/privado/reportes/:formato', async (peticion, respuesta) => {
  const desde = fecha(peticion.query.desde);
  const hasta = fecha(peticion.query.hasta);
  exigir(desde && hasta && desde <= hasta, 'Elegí un rango de fechas válido');
  const filas = await sql`SELECT fecha::text, tipo, concepto, monto, comision, impuesto, medio, cuenta FROM movimientos WHERE fecha BETWEEN ${desde} AND ${hasta} ORDER BY fecha, id`;
  if (peticion.params.formato === 'csv') {
    // escapar comillas y prefijar celdas q Excel podria interpretar como formulas
    const escapar = valor => '"' + String(valor ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
    respuesta.type('text/csv').attachment('finanzas-subli-b.csv').send('\uFEFF' + [['Fecha','Tipo','Concepto','Monto','Comisión','Impuesto incluido','Medio','Cuenta'], ...filas.map(fila => Object.values(fila))].map(fila => fila.map(escapar).join(';')).join('\r\n'));
  } else {
    exigir(peticion.params.formato === 'pdf', 'Formato no disponible');
    respuesta.type('pdf').attachment('finanzas-subli-b.pdf');
    generarReporte(respuesta, filas, desde, hasta);
  }
});
aplicacion.use('/api', (peticion, respuesta) => respuesta.status(404).json({ error: 'Ruta no encontrada' }));
aplicacion.use((error, peticion, respuesta, siguiente) => {
  if (respuesta.headersSent) return siguiente(error);
  const restricciones = ['23502','23503','23505','23514','22P02','22007','22008','22003'];
  const mensaje = error.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 5 MB' : restricciones.includes(error.code) ? 'Revisá los datos: hay un valor inválido, duplicado o una referencia inexistente' : error.estado ? error.message : 'No se pudo completar la operación';
  if (!error.estado && !restricciones.includes(error.code)) console.error('Error de operación:', error.code || error.message);
  respuesta.status(error.estado || (restricciones.includes(error.code) || error.code?.startsWith('LIMIT_') ? 400 : 500)).json({ error: mensaje });
});
try {
  await verificarBase();
  const servidor = aplicacion.listen(Number(process.env.PUERTO || 3000), process.env.HOST || '0.0.0.0', () => console.log(`Subli’B disponible en ${origen}`));
  const intervalo = setInterval(() => procesarNotificaciones().catch(() => console.error('No se pudieron procesar las notificaciones')), 60000);
  intervalo.unref();
  process.on('SIGTERM', () => { clearInterval(intervalo); servidor.close(); sql.end().then(() => process.exit(0)); });
} catch (error) {
  console.error(error.message);
  await sql.end();
  process.exitCode = 1;
}
