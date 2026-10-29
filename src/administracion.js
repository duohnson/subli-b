import { activarBusquedas, activarMovimiento, agruparOpcionales, normalizar } from './formularios-admin.js?v=20261023-2';
import { montarPartidas, activarDocumento } from './partidas-editor.js?v=20261023-5';
import { selectorMateriales, activarSelectorMateriales } from './selector-materiales.js?v=20261022-lotes-1';
import { mostrarEstadisticas } from './estadisticas.js?v=20261017-panel-2';
import { pedir, escapar as e, dinero, fechaCorta, datosFormulario } from './comun.js?v=20261017-panel-2';
const vista = document.querySelector('#vista');
const mensaje = document.querySelector('#mensaje-panel');
const editor = document.querySelector('#editor');
const formulario = document.querySelector('#formulario-editor');
const menu = document.querySelector('#menu');
let usuario;
let seccion = 'tablero';
let filas = [];
let guardar;
let pedidoAbierto = null;
let versionCarga = 0;
const filtrosGuardados = new Map();
let mesCalendario = fechaHoy().slice(0, 7);
const etiquetas = { empleados: 'Empleados', misventas: 'Mis ventas', tablero: 'Resumen del negocio', estadisticas: 'Estadísticas', pedidos: 'Pedidos y cotizaciones', produccion: 'Producción', calendario: 'Calendario', movimientos: 'Finanzas', clientes: 'Clientes y deudas', proveedores: 'Proveedores', compras: 'Compras', productos: 'Catálogo', inventario: 'Inventario', recetas: 'Materiales por producto', documentos: 'Facturas y documentos', calculadora: 'Calculadora de precios', disenos: 'Biblioteca de diseños', recordatorios: 'Recordatorios', notificaciones: 'Correos automáticos', usuarios: 'Usuarios', contenidos: 'Portada y galería', medios: 'Biblioteca de imágenes' };
const grupos = [
  ['Operación', ['tablero','estadisticas','pedidos','misventas','produccion','calendario','clientes']],
  ['Administración', ['movimientos','empleados','documentos','compras','proveedores','calculadora']],
  ['Productos', ['productos','inventario','recetas','disenos']],
  ['Sitio y ajustes', ['contenidos','medios','recordatorios','notificaciones','usuarios']]
];
const trazos = {
  estadisticas: 'M3 3v18h18 M7 17v-5 M12 17V7 M17 17V4',
  tablero: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  pedidos: 'M7 3h10v4H7z M7 5H4v16h16V5h-3 M8 12h8 M8 16h5',
  calendario: 'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2',
  clientes: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',
  movimientos: 'M3 5h18v14H3z M3 9h18 M15 14h3',
  productos: 'm12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M8 5l9 5',
  documentos: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6'
};
function icono(nombre) {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${trazos[nombre] || trazos.documentos}"/></svg>`;
}
const estados = { cotizacion: 'Cotización', pendiente: 'Pendiente', produccion: 'En producción', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' };
const siguientes = { cotizacion: ['pendiente','cancelado'], pendiente: ['produccion','cancelado'], produccion: ['listo'], listo: ['entregado'], entregado: [], cancelado: [] };
// definir los formularios por seccion para reutilizar el editor sin repetir todo el HTML
const campos = {
  empleados: [['nombre','Nombre'],['puesto','Puesto (opcional)'],['correo','Correo (opcional)','email'],['telefono','Teléfono'],['salario','Salario mensual (CRC)','number'],['usuario_id','Usuario existente (opcional)','@usuarios'],['activo','Empleado activo','checkbox']],
  contenidos: [['seccion','Dónde se muestra',['galeria','portada']],['nombre','Descripción de la imagen'],['imagen','Imagen','imagen'],['orden','Orden de aparición','number'],['activo','Visible en la página','checkbox']],
  productos: [['nombre','Nombre'],['categoria','Categoría'],['descripcion','Descripción','area'],['imagen','Fotografía principal','imagen'],['imagenes','Otras fotografías','imagenes'],['precio','Precio de venta','number'],['costo','Costo del producto','number'],['promocion','Promoción'],['personalizable','Permitir personalización','checkbox'],['activo','Visible en el catálogo','checkbox']],
  clientes: [['nombre','Nombre'],['correo','Correo (opcional)','email'],['telefono','Teléfono'],['direccion','Dirección'],['notas','Notas','area'],['limite_credito','Límite de crédito','number']],
  proveedores: [['nombre','Nombre'],['correo','Correo (opcional)','email'],['telefono','Teléfono'],['inventario_ids','Materiales que vende','@inventario-multiple'],['plazo_dias','Plazo de entrega (días)','number'],['notas','Notas','area']],
  inventario: [['producto_id','Producto del catálogo (vacío para insumos)','@productos'],['nombre','Nombre del producto o material'],['color','Color'],['talla','Talla'],['minimo','Alerta de mínimo','number'],['costo','Costo por unidad','number']],
  recetas: [['variante_id','Variante a producir','@inventario'],['material_id','Material que se consume','@inventario'],['cantidad','Cantidad por unidad producida','number']],
  recordatorios: [['titulo','Recordatorio'],['fecha','Fecha (opcional)','date'],['tipo','Tipo',['general','entrega','cobro','inventario','mantenimiento']],['completado','Completado','checkbox']],
  compras: [['proveedor_id','Proveedor','@proveedores'],['inventario_id','Material o producto','@inventario'],['cantidad','Cantidad','number'],['costo_unitario','Costo unitario','number'],['factura','Número de factura del proveedor'],['vencimiento','Fecha de pago','date'],['notas','Notas','area']],
  movimientos: [['tipo','Movimiento',['ingreso','gasto']],['concepto','Concepto'],['monto','Monto bruto','number'],['comision','Comisión adicional','number'],['impuesto','Impuesto incluido en el monto','number'],['medio','Medio de pago',['efectivo','banco','sinpe','tarjeta']],['cuenta','Cuenta bancaria o referencia'],['pedido_id','Pedido que se cobra (opcional)','@pedidos'],['compra_id','Compra que se paga (opcional)','@compras'],['fecha','Fecha (vacío = hoy)','date']],
  documentos: [['tipo','Tipo de documento',['cotizacion','proforma','recibo','comprobante','nota_credito','factura']],['pedido_id','Pedido (obligatorio solo para factura y comprobante)','@pedidos'],['cliente','Cliente (opcional; por defecto Cliente general)'],['correo','Correo (opcional)','email'],['direccion','Dirección (opcional)']],
  usuarios: [['nombre','Nombre'],['correo','Correo','email'],['clave','Contraseña (mínimo 12 caracteres)','password'],['rol','Permisos',['operador','administrador']]],
};
function tabla(columnas, registros, acciones = () => '') {
  if (!registros.length) return '<section class="tarjeta vacio">' + icono('documentos') + '<h3>Sin registros para mostrar</h3><p>Los datos aparecerán aquí al registrar operaciones o ajustar los filtros.</p></section>';
  return `<section class="tabla"><table><thead><tr>${columnas.map(([llave, titulo]) => `<th scope="col">${e(titulo)}</th>`).join('')}${acciones ? '<th scope="col">Acciones</th>' : ''}</tr></thead><tbody>${registros.map(fila => `<tr>${columnas.map(([llave, titulo, formato]) => `<td>${formato ? formato(fila[llave], fila) : e(fila[llave])}</td>`).join('')}${acciones ? `<td>${acciones(fila)}</td>` : ''}</tr>`).join('')}</tbody></table></section>`;
}
const boton = (accion, id, nombre) => `<button class="secundario" data-accion="${accion}" data-id="${id}">${nombre}</button>`;
const moneda = valor => dinero(valor);
const totalDeudas = deudas => (Array.isArray(deudas) ? deudas : []).reduce((total, deuda) => total + Number(deuda.monto || 0), 0);
const sino = valor => valor ? 'Sí' : 'No';
function estado(valor) { return `<span class="estado ${e(valor)}">${estados[valor] || e(valor)}</span>`; }
function fechaHoy() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }); }
async function activar(sesion) {
  usuario = sesion;
  document.querySelector('#acceso').hidden = true;
  document.querySelector('#panel').hidden = false;
  document.querySelector('#salir').hidden = false;
  document.querySelector('#saludo').textContent = `${usuario.nombre} · ${usuario.rol === 'administrador' ? 'Administrador' : 'Operador'}`;
  // ocultar las secciones q el operador no puede usar, sin reemplazar los permisos del servidor
  const disponibles = usuario.rol === 'administrador' ? Object.keys(etiquetas) : ['pedidos','misventas','produccion','calendario','disenos'];
  menu.innerHTML = grupos.map(([nombre, opciones]) => { const visibles = opciones.filter(llave => disponibles.includes(llave)); return visibles.length ? `<section class="grupo-menu"><p>${nombre}</p>${visibles.map(llave => `<button data-seccion="${llave}">${icono(llave)}<span>${etiquetas[llave]}</span></button>`).join('')}</section>` : ''; }).join('');
  seccion = usuario.rol === 'administrador' ? 'tablero' : disponibles[0];
  await cargar();
  // abrir directamente el pedido cuando el acceso viene de su codigo QR
  if (/^#pedido=\d+$/.test(location.hash)) { seccion = 'pedidos'; await abrirPedido(location.hash.slice(8)); }
}
document.querySelector('#ingresar').addEventListener('submit', async evento => {
  evento.preventDefault();
  try { await activar(await pedir('/api/ingresar', datosFormulario(evento.target))); document.querySelector('#error-acceso').textContent = ''; evento.target.reset(); }
  catch (error) { document.querySelector('#error-acceso').textContent = error.message; }
});
document.querySelector('#salir').addEventListener('click', async () => { try { await pedir('/api/salir', {}); location.reload(); } catch (error) { mensaje.textContent = error.message; } });
const abrirMenu = document.querySelector('#abrir-menu');
function cerrarMenuPanel() {
  abrirMenu.setAttribute('aria-expanded', 'false');
  menu.classList.remove('abierto');
}
abrirMenu.addEventListener('click', () => {
  const abierto = abrirMenu.getAttribute('aria-expanded') !== 'true';
  abrirMenu.setAttribute('aria-expanded', String(abierto));
  menu.classList.toggle('abierto', abierto);
});
document.addEventListener('keydown', evento => {
  if (evento.key === 'Escape' && abrirMenu.getAttribute('aria-expanded') === 'true') {
    cerrarMenuPanel(); abrirMenu.focus();
  }
});
menu.addEventListener('click', evento => {
  const boton = evento.target.closest('[data-seccion]');
  if (boton) {
    seccion = boton.dataset.seccion;
    cerrarMenuPanel();
    if (matchMedia('(max-width: 700px)').matches) abrirMenu.focus();
    cargar();
  }
});
editor.querySelector('.cerrar').addEventListener('click', () => editor.close());
formulario.addEventListener('submit', async evento => {
  evento.preventDefault();
  const enviar = formulario.querySelector('[type=submit]');
  if (enviar.disabled) return;
  enviar.disabled = true;
  let guardado = false;
  try {
    await guardar(datosFormulario(formulario));
    guardado = true;
    editor.close();
    mensaje.textContent = '';
    if (pedidoAbierto) await abrirPedido(pedidoAbierto.id); else await cargar();
    mensaje.textContent = mensaje.textContent ? `Operación guardada. No se pudo actualizar la vista: ${mensaje.textContent}` : 'Operación guardada';
  } catch (error) {
    if (guardado) mensaje.textContent = `Operación guardada. No se pudo actualizar la vista: ${error.message}`;
    else formulario.querySelector('[role=alert]').textContent = error.message;
  } finally { enviar.disabled = false; }
});
formulario.addEventListener('change', async evento => {
  const nombre = evento.target.dataset.subir;
  if (!nombre || !evento.target.files[0]) return;
  const enviar = formulario.querySelector('[type=submit]');
  enviar.disabled = true;
  try {
    for (const archivo of evento.target.files) {
      const datos = new FormData(); datos.append('imagen', archivo);
      const medio = await pedir('/api/privado/medios',datos);
      const opcion = document.createElement('option'); opcion.value = medio.imagen; opcion.textContent = medio.nombre; opcion.selected = true;
      formulario.elements[nombre].append(opcion);
    }
    evento.target.value = '';
    formulario.querySelector('[role=alert]').textContent = 'Imagen subida. Guardá el formulario para publicar el cambio.';
  } catch (error) { formulario.querySelector('[role=alert]').textContent = error.message; }
  finally { enviar.disabled = false; }
});
async function abrirFormulario(titulo, definicion, valores, accion) {
  document.querySelector('#titulo-editor').textContent = titulo;
  const entradas = [];
  const listas = new Map();
  const opcionesDe = ruta => {
    if (!listas.has(ruta)) listas.set(ruta, pedir(`/api/privado/${ruta}`));
    return listas.get(ruta);
  };
  const recurso = Object.keys(campos).find(llave => campos[llave] === definicion) || (definicion.some(c => c[0] === 'crear_variante') ? 'productos' : definicion.some(c => c[0] === 'producto_id') ? 'inventario' : null);
  for (const [nombre, etiqueta, tipo = 'text'] of definicion) {
    const valor = valores[nombre] ?? (tipo === 'checkbox' ? ['activo','personalizable'].includes(nombre) : tipo === 'number' ? nombre === 'cantidad' ? 1 : 0 : '');
    let control;
    if (tipo === 'imagenes') {
      const medios = await opcionesDe('medios');
      const seleccionadas = valores.imagenes || [];
      const opciones = [...seleccionadas.filter(imagen => !medios.some(medio => medio.imagen === imagen)).map(imagen => ({ imagen, nombre: 'Imagen actual' })), ...medios];
      control = `<select name="${nombre}" multiple size="6">${opciones.map(medio => `<option value="${e(medio.imagen)}" ${seleccionadas.includes(medio.imagen) ? 'selected' : ''}>${e(medio.nombre)}</option>`).join('')}</select><span>Seleccioná varias con Ctrl o ⌘. Desmarcá las que quieras quitar del producto.</span><span>O subí varias fotografías (PNG o JPEG, hasta 5 MB cada una)</span><input type="file" accept="image/png,image/jpeg" multiple data-subir="${nombre}">`;
    } else if (tipo === 'imagen') {
      const medios = await opcionesDe('medios');
      control = `<select name="${nombre}"><option value="">Sin imagen</option>${valor && !medios.some(medio => medio.imagen === valor) ? `<option value="${e(valor)}" selected>Imagen actual</option>` : ''}${medios.map(medio => `<option value="${medio.imagen}" ${medio.imagen === valor ? 'selected' : ''}>${e(medio.nombre)}</option>`).join('')}</select><span>O subí una nueva fotografía (PNG o JPEG, hasta 5 MB)</span><input type="file" accept="image/png,image/jpeg" data-subir="${nombre}">`;
    } else if (Array.isArray(tipo)) control = `<select name="${nombre}">${tipo.map(opcion => `<option value="${e(opcion)}" ${opcion === valor ? 'selected' : ''}>${e(opcion === 'galeria' ? 'Trabajos realizados' : opcion === 'portada' ? 'Productos destacados de la portada' : estados[opcion] || opcion.replaceAll('_', ' '))}</option>`).join('')}</select>`;
    else if (tipo === '@inventario-multiple') {
      const opciones = await opcionesDe('inventario');
      control = selectorMateriales(opciones, valores.inventario_ids || []);
    } else if (tipo.startsWith('@')) {
      const opciones = await opcionesDe(tipo.slice(1));
      control = `<select name="${nombre}"><option value="">Seleccionar</option>${opciones.map(opcion => `<option value="${opcion.id}" ${String(valor) === String(opcion.id) ? 'selected' : ''}>#${opcion.id} · ${e(opcion.nombre || opcion.cliente || opcion.proveedor || '')} ${e(opcion.color || '')} ${e(opcion.talla || '')}</option>`).join('')}</select>`;
    } else if (tipo === 'area') control = `<textarea name="${nombre}">${e(valor)}</textarea>`;
    else if (tipo === 'checkbox') control = `<input type="checkbox" name="${nombre}" ${valor ? 'checked' : ''}>`;
    else control = `<input name="${nombre}" type="${tipo}" value="${e(tipo === 'date' && valor ? fechaCorta(valor) : valor)}" ${tipo === 'number' ? `min="${nombre === 'cantidad' ? 1 : 0}" step="${['cantidad','existencias','minimo','orden','plazo_dias'].includes(nombre) ? 1 : '0.01'}"` : ''} ${['nombre','correo','titulo','concepto','clave'].includes(nombre) && !etiqueta.includes('(opcional)') && !definicion.some(campo => campo[0] === 'cliente_id') && (nombre !== 'correo' || definicion.some(campo => campo[0] === 'clave')) ? 'required' : ''} ${nombre === 'clave' ? 'minlength="12" autocomplete="new-password"' : ''}>`;
    const ayuda = seccion === 'productos' && nombre === 'costo' ? '<span>Lo que te costó comprarlo; no es el precio que cobrarás al cliente.</span>' : '';
    if (tipo === '@inventario-multiple') { entradas.push(control); continue; }
    entradas.push(`<label ${tipo === 'checkbox' ? 'class="casilla"' : ''}>${e(etiqueta)}${control}${ayuda}</label>`);
  }
  formulario.innerHTML = entradas.join('') + '<p role="alert"></p><button class="boton" type="submit">Guardar</button>';
  activarSelectorMateriales(formulario);
  if (recurso === 'compras') {
    const ayuda = document.createElement('p');
    ayuda.textContent = 'Podés elegir cualquier material. Al guardar se vinculará automáticamente al proveedor.';
    formulario.elements.inventario_id.closest('label').after(ayuda);
  }
  const preparar = recurso === 'documentos' ? activarDocumento(formulario) : datos => datos;
  if (recurso === 'movimientos') activarMovimiento(formulario, await opcionesDe('pedidos'), await opcionesDe('compras'));
  if (recurso === 'recetas') {
    formulario.elements.variante_id.required = true;
    formulario.elements.material_id.required = true;
    formulario.elements.cantidad.required = true;
  }
  if (recurso === 'productos') {
    formulario.elements.precio.required = true;
    if (formulario.elements.crear_variante) {
      const cambiar = () => { formulario.elements.existencias.disabled = !formulario.elements.crear_variante.checked; formulario.elements.existencias.closest('label').hidden = !formulario.elements.crear_variante.checked; };
      formulario.elements.crear_variante.addEventListener('change', cambiar);
      cambiar();
    }
  }
  activarBusquedas(formulario);
  const secundarios = {
    clientes: ['correo','telefono','direccion','notas','limite_credito'],
    empleados: ['puesto','correo','telefono','salario','usuario_id'],
    proveedores: ['correo','telefono','plazo_dias','notas'],
    productos: ['categoria','descripcion','imagen','imagenes','costo','promocion'],
    inventario: ['color','talla','minimo','costo'],
    movimientos: ['comision','impuesto','cuenta','fecha']
  };
  agruparOpcionales(formulario, secundarios[recurso] || []);
  guardar = datos => accion(preparar(datos));
  editor.showModal();
}
function mesDesplazado(mes, cambio) {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, numero - 1 + cambio, 1)).toISOString().slice(0, 7);
}
function mostrarCalendario() {
  const [anio, mes] = mesCalendario.split('-').map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const celdas = Math.ceil((desplazamiento + diasDelMes) / 7) * 7;
  const tituloMes = new Intl.DateTimeFormat('es-CR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero);
  const pedidosDelMes = filas.filter(fila => String(fila.fecha_prometida || '').slice(0, 7) === mesCalendario);
  const sinFecha = filas.filter(fila => !fila.fecha_prometida);
  const nombresDias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const dias = Array.from({ length: celdas }, (_, indice) => {
    const fecha = new Date(Date.UTC(anio, mes - 1, indice - desplazamiento + 1)).toISOString().slice(0, 10);
    const delMes = fecha.slice(0, 7) === mesCalendario;
    const pedidos = filas.filter(fila => fechaCorta(fila.fecha_prometida) === fecha);
    return `<section class="calendario-dia ${delMes ? '' : 'fuera-mes'} ${fecha === fechaHoy() ? 'hoy' : ''}" role="gridcell" aria-label="${fecha}"><time datetime="${fecha}">${Number(fecha.slice(8, 10))}</time><div class="calendario-eventos">${pedidos.map(fila => `<button type="button" class="evento-calendario ${e(fila.estado)}" data-accion="detalle" data-id="${fila.id}" title="Pedido #${fila.id} · ${e(fila.cliente)} · ${estados[fila.estado] || e(fila.estado)}"><strong>#${fila.id} · ${e(fila.cliente)}</strong><span>${estados[fila.estado] || e(fila.estado)}</span></button>`).join('')}</div></section>`;
  }).join('');
  const listaSinFecha = sinFecha.length ? `<section class="pedidos-sin-fecha"><h2>Pedidos sin fecha prometida <span>${sinFecha.length}</span></h2><div>${sinFecha.map(fila => `<button type="button" class="evento-calendario ${e(fila.estado)}" data-accion="detalle" data-id="${fila.id}"><strong>#${fila.id} · ${e(fila.cliente)}</strong><span>${estados[fila.estado] || e(fila.estado)}</span></button>`).join('')}</div></section>` : '';
  vista.innerHTML = `<section class="calendario-contenedor"><header class="calendario-controles"><button type="button" class="secundario" data-accion="mes-anterior" aria-label="Mes anterior">←</button><h2>${e(tituloMes)}</h2><button type="button" class="secundario" data-accion="mes-hoy">Hoy</button><button type="button" class="secundario" data-accion="mes-siguiente" aria-label="Mes siguiente">→</button></header><p class="calendario-resumen">${filas.length} pedidos en total · ${pedidosDelMes.length} con entrega este mes · Se muestran todos los estados.</p><div class="calendario-rejilla" role="grid" aria-label="Pedidos por fecha de entrega">${nombresDias.map(dia => `<div class="calendario-nombre-dia" role="columnheader">${dia}</div>`).join('')}${dias}</div>${listaSinFecha}</section>`;
}
async function cargar() {
  const version = ++versionCarga;
  pedidoAbierto = null;
  vista.dataset.seccion = seccion;
  mensaje.textContent = '';
  vista.textContent = 'Cargando…';
  document.querySelector('#titulo-panel').textContent = etiquetas[seccion];
  menu.querySelectorAll('button').forEach(elemento => { const activo = elemento.dataset.seccion === seccion; elemento.classList.toggle('activo', activo); if (activo) elemento.setAttribute('aria-current', 'page'); else elemento.removeAttribute('aria-current'); });
  document.querySelector('#contexto-panel').textContent = seccion === 'tablero' ? `Vista general de ventas, cobros y producción · ${new Date().toLocaleDateString('es-CR', { dateStyle: 'long', timeZone: 'America/Costa_Rica' })}` : `Consulte y gestione ${etiquetas[seccion].toLocaleLowerCase('es')}.`;
  try {
    if (seccion === 'misventas') return await mostrarMisVentas();
    if (seccion === 'tablero') return await mostrarTablero();
    if (seccion === 'estadisticas') {
      document.querySelector('#contexto-panel').textContent = 'Ventas, evolución y rendimiento del negocio. Comparación anual con datos reales.';
      return await mostrarEstadisticas(vista);
    }
    if (seccion === 'calculadora') return mostrarCalculadora();
    const registros = await pedir(`/api/privado/${['produccion','calendario'].includes(seccion) ? 'pedidos' : seccion}`);
    if (version !== versionCarga) return;
    filas = registros;
    if (seccion === 'produccion') {
      const ordenados = filas.filter(fila => !['cotizacion','cancelado','entregado'].includes(fila.estado)).sort((a,b) => String(a.fecha_prometida || '9999').localeCompare(String(b.fecha_prometida || '9999')));
      vista.innerHTML = `<p>Trabajos ordenados por fecha prometida. Las entregas vencidas se destacan en rojo.</p><section class="calendario">${ordenados.map(fila => `<article class="tarjeta ${fila.fecha_prometida && fechaCorta(fila.fecha_prometida) < fechaHoy() && fila.estado !== 'entregado' ? 'atrasado' : ''}"><p class="etiqueta">${fechaCorta(fila.fecha_prometida)}</p><h2>#${fila.id} · ${e(fila.cliente)}</h2>${estado(fila.estado)}<p>${e(fila.responsable || 'Sin responsable')}</p>${boton('detalle', fila.id, 'Ver trabajo')}</article>`).join('') || '<p>No hay trabajos programados.</p>'}</section>`;
      return;
    }
    if (seccion === 'calendario') return mostrarCalendario();
    if (seccion === 'medios') {
      vista.innerHTML = `<p>Subí fotografías y luego seleccionalas en el catálogo, la portada o la galería.</p><form id="subir-medio" class="filtros"><label>Nueva imagen (PNG o JPEG, hasta 5 MB)<input name="imagen" type="file" accept="image/png,image/jpeg" required></label><button class="boton">Subir imagen</button></form><section class="productos">${filas.map(medio => `<article class="producto"><img src="${medio.imagen}" alt="${e(medio.nombre)}" loading="lazy"><p>${e(medio.nombre)}</p></article>`).join('')}</section>`;
      document.querySelector('#subir-medio').addEventListener('submit', async evento => { evento.preventDefault(); const boton = evento.target.querySelector('button'); boton.disabled = true; try { await pedir('/api/privado/medios',new FormData(evento.target)); await cargar(); } catch (error) { mensaje.textContent = error.message; boton.disabled = false; } });
      return;
    }
    let columnas = [];
    let acciones = fila => boton('editar', fila.id, 'Editar');
    let crear = Boolean(campos[seccion]);
    if (seccion === 'pedidos') { columnas = [['id','Pedido'],['cliente','Cliente'],['estado','Estado',estado],['total','Total',moneda],['pagado','Pagado',moneda],['saldo','Saldo',moneda],['fecha_prometida','Entrega',fechaCorta],['responsable','Responsable']]; acciones = fila => boton('detalle', fila.id, 'Abrir') + (usuario.rol === 'administrador' && !['cotizacion','cancelado'].includes(fila.estado) && Number(fila.saldo) > 0 ? boton('cobrar',fila.id,'Cobrar') : ''); crear = true; }
    if (seccion === 'empleados') { columnas = [['nombre','Empleado'],['puesto','Puesto'],['salario','Salario mensual',moneda],['acceso','Usuario'],['activo','Activo',sino],['acceso_activo','Acceso habilitado',sino]]; acciones = fila => boton('editar',fila.id,'Editar') + boton('historial-empleado',fila.id,'Ventas y pagos') + (fila.activo ? boton('pagar-salario',fila.id,'Registrar salario') + (!fila.usuario_id ? boton('usuario-empleado',fila.id,'Crear usuario') : '') : ''); }
    if (seccion === 'clientes') columnas = [['id','ID'],['nombre','Cliente'],['correo','Correo'],['telefono','Teléfono'],['deudas','Deuda registrada',deudas => moneda(totalDeudas(deudas))],['limite_credito','Límite de crédito',moneda]];
    if (seccion === 'proveedores') columnas = [['id','ID'],['nombre','Proveedor'],['telefono','Teléfono'],['productos_vinculados','Materiales y productos'],['plazo_dias','Entrega (días)']];
    if (seccion === 'contenidos') { columnas = [['seccion','Ubicación',valor => valor === 'galeria' ? 'Trabajos realizados' : 'Portada'],['nombre','Descripción'],['orden','Orden'],['activo','Visible',sino]]; acciones = fila => boton('editar',fila.id,'Editar') + boton('eliminar-contenido',fila.id,'Eliminar'); }
    if (seccion === 'productos') columnas = [['id','ID'],['nombre','Producto'],['categoria','Categoría'],['precio','Precio',moneda],['activo','Publicado',sino]];
    if (seccion === 'inventario') { columnas = [['id','ID'],['nombre','Producto / material'],['color','Color'],['talla','Talla'],['existencias','Existencias'],['reservado','Reservado'],['minimo','Mínimo'],['costo','Costo',moneda]]; acciones = fila => boton('editar',fila.id,'Editar') + boton('ajustar',fila.id,'Ajustar existencia'); }
    if (seccion === 'recetas') columnas = [['id','ID'],['variante','Variante'],['material','Material'],['cantidad','Consumo por unidad']];
    if (seccion === 'compras') { columnas = [['id','Compra'],['proveedor','Proveedor'],['material','Producto'],['cantidad','Cantidad'],['costo_unitario','Costo unitario',moneda],['total','Total',moneda],['pagado','Pagado',moneda],['vencimiento','Vence',fechaCorta],['recibida','Recibida',sino]]; acciones = fila => (fila.recibida ? '' : boton('recibir', fila.id, 'Recibir inventario')) + (Number(fila.total) > Number(fila.pagado) ? boton('pagar-compra',fila.id,'Pagar') : ''); }
    if (seccion === 'movimientos') { columnas = [['fecha','Fecha',fechaCorta],['tipo','Tipo'],['concepto','Concepto'],['monto','Monto',moneda],['comision','Comisión',moneda],['impuesto','Impuesto incluido',moneda],['medio','Medio'],['cuenta','Cuenta'],['pedido_id','Pedido'],['compra_id','Compra']]; acciones = null; }
    if (seccion === 'recordatorios') { columnas = [['titulo','Recordatorio'],['fecha','Fecha',fechaCorta],['tipo','Tipo'],['completado','Completado',sino]]; acciones = fila => boton('completar',fila.id,fila.completado ? 'Marcar pendiente' : 'Completar') + boton('editar',fila.id,'Editar'); }
    if (seccion === 'documentos') { columnas = [['id','Número'],['pedido_id','Pedido',valor => valor ? `#${e(valor)}` : 'Independiente'],['tipo','Documento'],['total','Total',moneda],['creado','Fecha',fechaCorta]]; acciones = fila => `<a class="secundario" href="/api/privado/documentos/${fila.id}/pdf" target="_blank" rel="noopener">Descargar PDF</a>`; }
    if (seccion === 'disenos') { columnas = [['cliente','Cliente'],['productos','Productos'],['pedido_id','Pedido'],['nombre','Archivo'],['es_previa','Vista previa',sino]]; acciones = fila => `<a class="secundario" href="/api/seguimiento/${fila.codigo}/archivos/${fila.id}" target="_blank" rel="noopener">Ver diseño</a>` + boton('repetir',fila.pedido_id,'Repetir pedido'); }
    if (seccion === 'notificaciones') { columnas = [['destinatario','Destinatario'],['asunto','Asunto'],['enviada','Enviado',valor => valor ? fechaCorta(valor) : 'Pendiente'],['intentos','Intentos'],['error','Último error']]; acciones = fila => fila.enviada ? '' : boton('reintentar',fila.id,'Reintentar'); }
    if (seccion === 'usuarios') { columnas = [['nombre','Nombre'],['correo','Correo'],['rol','Permisos'],['activo','Activo',sino]]; acciones = fila => fila.id === usuario.id ? 'Tu usuario' : boton('usuario',fila.id,fila.activo ? 'Desactivar' : 'Activar'); }
    if (seccion === 'clientes') acciones = fila => boton('editar',fila.id,'Editar') + boton('historial',fila.id,'Historial y saldo') + boton('deudas',fila.id,'Deudas');
    vista.innerHTML = `<section class="acciones">${crear ? '<button class="boton" data-accion="nuevo">Agregar registro</button>' : ''}<label>Buscar<input id="buscar-tabla" type="search" placeholder="Filtrar registros"></label></section>${seccion === 'contenidos' ? `<p>${filas.filter(fila => fila.seccion === 'galeria' && fila.activo).length} trabajos realizados visibles · ${filas.filter(fila => fila.seccion === 'portada' && fila.activo).length} imágenes visibles en portada. Para mostrar un trabajo en el inicio, elegí Trabajos realizados y marcá Visible en la página.</p>` : ''}${seccion === 'empleados' ? '<p>El salario mensual es una referencia. Registrar el pago lo suma a gastos una sola vez por mes. El puesto describe su trabajo; los permisos se asignan al crear su usuario.</p>' : ''}${seccion === 'documentos' ? '<p>Documentos internos, sin emisión electrónica tributaria. Las notas de crédito no modifican cobros ni inventario.</p>' : ''}${seccion === 'compras' ? '<p>Compará el costo unitario por producto y proveedor. Recibir una compra aumenta el inventario; podés pagar directamente con el botón Pagar.</p>' : ''}<section id="registros">${tabla(columnas, filas, acciones)}</section>`;
    const buscador = document.querySelector('#buscar-tabla');
    buscador.value = filtrosGuardados.get(seccion) || '';
    const filtrar = () => {
      filtrosGuardados.set(seccion, buscador.value);
      const palabras = normalizar(buscador.value).split(/\s+/).filter(Boolean);
      const visibles = filas.filter(fila => palabras.every(palabra => normalizar(Object.values(fila).join(' ')).includes(palabra)));
      document.querySelector('#registros').innerHTML = tabla(columnas, visibles, acciones);
    };
    buscador.addEventListener('input', filtrar);
    filtrar();
  } catch (error) { if (version === versionCarga) { vista.textContent = ''; mensaje.textContent = error.message; } }
}
async function mostrarTablero(desde = fechaHoy().slice(0,7) + '-01', hasta = fechaHoy()) {
  const version = versionCarga;
  const datos = await pedir(`/api/privado/tablero?desde=${desde}&hasta=${hasta}`);
  if (version !== versionCarga || seccion !== 'tablero') return;
  const activos = datos.pedidos.filter(pedido => !['cotizacion','cancelado'].includes(pedido.estado));
  // sumar las ventas aprobadas del periodo, no confundirlas con el dinero ya cobrado
  const ventas = activos.filter(pedido => fechaCorta(pedido.creado) >= desde && fechaCorta(pedido.creado) <= hasta).reduce((total,pedido) => total + Number(pedido.total), 0);
  const pendientes = activos.filter(pedido => pedido.estado !== 'entregado');
  const porCobrar = activos.reduce((total,pedido) => total + Number(pedido.saldo), 0);
  const resultado = Number(datos.finanzas.ingresos) - Number(datos.finanzas.gastos) - Number(datos.finanzas.comisiones);
  vista.innerHTML = `<section class="cabecera-tablero"><div><p class="etiqueta">RESUMEN DEL NEGOCIO</p><h2>Administracion principal</h2><p>Ventas, cobros y producción para el período seleccionado.</p></div><div class="cabecera-tablero__badge">${datos.pedidos.length} <small>pedidos en total</small></div></section><section class="accesos-panel" aria-label="Accesos rápidos"><button class="secundario" data-accion="ir" data-id="pedidos">${icono('pedidos')} Gestionar pedidos</button><button class="secundario" data-accion="ir" data-id="movimientos">${icono('movimientos')} Registrar movimiento</button><button class="secundario" data-accion="ir" data-id="productos">${icono('productos')} Administrar catálogo</button></section><form id="periodo" class="filtros"><label>Desde<input name="desde" type="date" required value="${desde}"></label><label>Hasta<input name="hasta" type="date" required value="${hasta}"></label><button class="boton">Actualizar</button><a class="secundario" href="/api/privado/reportes/csv?desde=${desde}&hasta=${hasta}">Excel (CSV)</a><a class="secundario" href="/api/privado/reportes/pdf?desde=${desde}&hasta=${hasta}">PDF</a></form><section class="indicadores">${[['Ventas del período',dinero(ventas)],['Gastos del período',dinero(datos.finanzas.gastos)],['Por cobrar · todos los pedidos',dinero(porCobrar)],['Pedidos pendientes',pendientes.length],['Ingresos cobrados',dinero(datos.finanzas.ingresos)],['Flujo neto de efectivo',dinero(resultado)],['Comisiones',dinero(datos.finanzas.comisiones)],['Impuestos incluidos',dinero(datos.finanzas.impuestos)]].map(([nombre,valor]) => `<article><p>${nombre}</p><strong>${valor}</strong></article>`).join('')}</section><section class="columnas"><article class="tarjeta"><h2>Estado de los pedidos</h2><section class="grafico">${datos.estados.map(fila => `<label>${estados[fila.estado]}<meter min="0" max="${Math.max(1,datos.pedidos.length)}" value="${fila.cantidad}"></meter><span>${fila.cantidad}</span></label>`).join('') || '<p>Los pedidos aparecerán aquí.</p>'}</section></article><article class="tarjeta"><h2>Recordatorios</h2><ul class="lista">${datos.recordatorios.map(fila => `<li>${fechaCorta(fila.fecha)} · ${e(fila.titulo)}</li>`).join('') || '<li>No hay recordatorios pendientes</li>'}${datos.inventario.map(fila => `<li>Reponer ${e(fila.nombre)} ${e(fila.color)} ${e(fila.talla)}: ${Number(fila.existencias) - Number(fila.reservado)} disponibles</li>`).join('')}</ul></article></section><h2>Próximas entregas</h2>${tabla([['id','Pedido'],['cliente','Cliente'],['fecha_prometida','Entrega',fechaCorta],['estado','Estado',estado],['saldo','Saldo',moneda]], pendientes.slice().sort((a,b) => String(a.fecha_prometida || '9999').localeCompare(String(b.fecha_prometida || '9999'))).slice(0,10), fila => boton('abrir-pedido',fila.id,'Ver pedido'))}<section class="columnas"><article class="tarjeta"><h2>Ventas por categoría</h2>${tabla([['categoria','Categoría'],['unidades','Unidades'],['ventas','Ventas',moneda],['ganancia','Margen estimado',moneda]],datos.categorias,null)}</article><article class="tarjeta"><h2>Flujo neto por mes</h2>${tabla([['mes','Mes'],['resultado','Resultado',moneda]],datos.meses,null)}</article><article class="tarjeta"><h2>Productos más vendidos</h2>${tabla([['nombre','Producto'],['unidades','Unidades']],datos.productos,null)}</article><article class="tarjeta"><h2>Clientes frecuentes</h2>${tabla([['nombre','Cliente'],['pedidos','Pedidos'],['total','Compras',moneda]],datos.frecuentes,null)}</article></section><h2>Ventas por usuario</h2>${tabla([['nombre','Empleado / usuario'],['puesto','Puesto'],['pedidos','Pedidos aprobados'],['ventas','Ventas',moneda]],datos.vendedores,null)}<h2>Pedidos con pérdida estimada</h2><p>Comparación entre precio y costo de productos y materiales al cotizar. El flujo de efectivo se calcula con los movimientos registrados.</p>${tabla([['id','Pedido'],['cliente','Cliente'],['total','Venta',moneda],['costo','Costo estimado',moneda]],activos.filter(pedido => Number(pedido.costo) > Number(pedido.total)),null)}`;
  document.querySelector('#periodo').addEventListener('submit', async evento => { evento.preventDefault(); const d = datosFormulario(evento.target); if (d.desde > d.hasta) { mensaje.textContent = 'Revisá el rango de fechas'; return; } try { await mostrarTablero(d.desde,d.hasta); } catch (error) { mensaje.textContent = error.message; } });
}
function mostrarCalculadora() {
  const campo = (llave, nombre, valor = 0, ayuda = '') => {
    const porcentaje = ['comision_porcentaje','margen','descuento','iva_porcentaje'].includes(llave);
    const maximo = ['comision_porcentaje','margen','descuento'].includes(llave) ? 99.99 : llave === 'iva_porcentaje' ? 100 : null;
    return `<label>${nombre}<input name="${llave}" type="number" min="${llave === 'cantidad' ? 1 : 0}" ${maximo === null ? '' : `max="${maximo}"`} step="${llave === 'cantidad' ? 1 : '0.01'}" value="${valor}" ${llave === 'cantidad' ? 'required' : ''}>${ayuda ? `<small>${ayuda}</small>` : porcentaje ? '<small>Ingresá solo el número, sin el símbolo %.</small>' : ''}</label>`;
  };
  vista.innerHTML = `<p>Calculá un precio para productos sublimados. El margen bruto descuenta los costos de producción; el margen neto estimado también descuenta los gastos indirectos y la comisión de cobro. El impuesto se suma al cobro y no se considera ganancia.</p><p><strong>Cómo llenar los campos:</strong> los costos se escriben en colones (₡), sin el símbolo; los porcentajes se escriben como números enteros o decimales (por ejemplo, 30 significa 30 %); el tiempo va en minutos y la cantidad en unidades enteras.</p><form id="calcular" class="formulario tarjeta">
    <fieldset class="grupo-calculo"><legend>Costos de producción por unidad</legend><p>Ingresá montos en colones (₡) por unidad y tiempos en minutos.</p><div class="campos-calculo">${campo('producto','Producto base (₡ taza, camiseta, etc.)',0,'Ejemplo: escribí 1000 para ₡1 000')}${campo('materiales','Materiales de sublimación (₡ por unidad)','0','Tinta, papel y cinta; por ejemplo, 200 = ₡200')}${campo('electricidad','Electricidad (₡ por unidad)',0,'Monto en colones atribuible a una unidad')}${campo('minutos','Minutos de trabajo',0,'Ejemplo: 30 significa 30 minutos')}${campo('maquina_hora','Uso y mantenimiento de máquina (₡ por hora)',0,'Costo horario en colones')}${campo('mano_hora','Mano de obra (₡ por hora)',0,'Costo horario en colones')}</div></fieldset>
    <fieldset class="grupo-calculo"><legend>Gastos (opcionales)</legend><p>Ingresá los gastos en colones por unidad. Para comisiones y margen, escribí solo el porcentaje.</p><div class="campos-calculo">${campo('gastos_adicionales','Empaque, transporte u otros (₡ por unidad)',0,'Ejemplo: 100 significa ₡100 por producto')}${campo('comision_porcentaje','Comisión de pago (%)',0,'Ejemplo: 2 significa 2 %, no 0,02')}${campo('margen','Margen bruto objetivo (%)',30,'Ejemplo: 30 significa 30 %; rango permitido: 0 a 99,99 %')}</div></fieldset>
    <fieldset class="grupo-calculo"><legend>Precio, cantidad e impuesto</legend><div class="campos-calculo">${campo('descuento','Descuento por cantidad (%)',0,'Ejemplo: 10 significa 10 %; rango permitido: 0 a 99,99 %')}${campo('cantidad','Cantidad de unidades',1,'Número entero; ejemplo: 5 unidades')}<label class="casilla"><input name="iva" type="checkbox">Agregar impuesto al cobro</label>${campo('iva_porcentaje','Tasa de impuesto (%)',13,'Ejemplo: 13 significa 13 %')}</div><small>Usá la tasa que corresponda a tu operación; el impuesto no forma parte de la ganancia.</small></fieldset>
    <button class="boton">Calcular precio</button><output id="resultado-calculo" class="resultado-calculo" aria-live="polite"></output></form>`;
  const calculadora = document.querySelector('#calcular');
  const casillaImpuesto = calculadora.elements.iva;
  calculadora.elements.iva_porcentaje.disabled = !casillaImpuesto.checked;
  casillaImpuesto.addEventListener('change', () => { calculadora.elements.iva_porcentaje.disabled = !casillaImpuesto.checked; });
  calculadora.addEventListener('submit', async evento => {
    evento.preventDefault();
    try {
      const valores = datosFormulario(evento.target);
      const resultado = await pedir('/api/privado/calcular', valores);
      const cantidad = Number(valores.cantidad);
      const totalCobrar = resultado.totalConIva ?? resultado.total;
      const costosOperativosUnidad = Number((resultado.gastos_adicionales + resultado.comision).toFixed(2));
      const costosOperativosPedido = Number((costosOperativosUnidad * cantidad).toFixed(2));
      document.querySelector('#resultado-calculo').innerHTML = `<section class="resultado-calculo__hero"><div class="resultado-calculo__bruto"><span class="resultado-calculo__eyebrow">Margen bruto por unidad</span><strong class="resultado-calculo__costo">${dinero(resultado.margen_bruto)}</strong><small>${resultado.porcentaje_margen_bruto.toLocaleString('es-CR',{maximumFractionDigits:1})}% de venta después del descuento</small></div><div class="resultado-calculo__precio"><span>Margen neto estimado por unidad</span><strong>${dinero(resultado.margen_neto)}</strong><small>${resultado.porcentaje_margen_neto.toLocaleString('es-CR',{maximumFractionDigits:1})}% después de gastos y comisión</small></div></section><section class="resultado-calculo__operativos"><div class="resultado-calculo__detalle-cabecera"><h3>Costos operativos</h3><span>por unidad y para ${cantidad} ${cantidad === 1 ? 'unidad' : 'unidades'}</span></div><div class="resultado-calculo__operativos-grid"><div><span>Gastos indirectos</span><strong>${dinero(resultado.gastos_adicionales)}</strong><small>${dinero(resultado.gastos_adicionales * cantidad)} en el pedido</small></div><div><span>Comisión de cobro · ${resultado.comision_porcentaje}%</span><strong>${dinero(resultado.comision)}</strong><small>${dinero(resultado.comision * cantidad)} en el pedido</small></div><div class="resultado-calculo__operativos-total"><span>Total de costos operativos</span><strong>${dinero(costosOperativosUnidad)}</strong><small>${dinero(costosOperativosPedido)} en el pedido</small></div></div></section><section class="resultado-calculo__detalle"><div class="resultado-calculo__detalle-cabecera"><h3>Desglose por unidad</h3><span>${Number(valores.minutos)} min de producción</span></div><div class="resultado-calculo__fila"><span>Producto base</span><strong>${dinero(resultado.costo_producto)}</strong></div><div class="resultado-calculo__fila"><span>Materiales de sublimación</span><strong>${dinero(resultado.costo_materiales)}</strong></div><div class="resultado-calculo__fila"><span>Electricidad</span><strong>${dinero(resultado.costo_electricidad)}</strong></div><div class="resultado-calculo__fila"><span>Uso y mantenimiento de máquina</span><strong>${dinero(resultado.costo_maquina)}</strong></div><div class="resultado-calculo__fila"><span>Mano de obra</span><strong>${dinero(resultado.costo_mano_obra)}</strong></div><div class="resultado-calculo__fila resultado-calculo__costo-final"><span>Costo de producción</span><strong>${dinero(resultado.costo)}</strong></div><div class="resultado-calculo__fila"><span>Precio de lista sugerido</span><strong>${dinero(resultado.precio_lista)}</strong></div><div class="resultado-calculo__fila"><span>Descuento · ${resultado.descuento}%</span><strong>− ${dinero(resultado.precio_lista - resultado.precio)}</strong></div><div class="resultado-calculo__fila"><span>Precio final por unidad</span><strong>${dinero(resultado.precio)}</strong></div><div class="resultado-calculo__fila resultado-calculo__otros-gastos"><span>Gastos indirectos por unidad</span><strong>− ${dinero(resultado.gastos_adicionales)}</strong></div><div class="resultado-calculo__fila resultado-calculo__otros-gastos"><span>Comisión de cobro · ${resultado.comision_porcentaje}%</span><strong>− ${dinero(resultado.comision)}</strong></div>${valores.iva === true ? `<div class="resultado-calculo__fila resultado-calculo__iva"><span>Impuesto · ${Number(valores.iva_porcentaje)}% · no es ganancia</span><strong>${dinero(resultado.iva)}</strong></div>` : ''}<p class="resultado-calculo__nota">Margen bruto = precio final menos costo de producción. Margen neto estimado = margen bruto menos gastos indirectos y comisión. No incluye gastos generales que no hayas asignado por unidad.</p></section><section class="resultado-calculo__total"><div><span>${valores.iva === true ? 'Total a cobrar con impuesto' : 'Total de venta'} · ${cantidad} ${cantidad === 1 ? 'unidad' : 'unidades'}</span><strong>${dinero(totalCobrar)}</strong>${valores.iva === true ? `<small>${dinero(resultado.iva)} de impuesto incluido</small>` : ''}</div><div class="resultado-calculo__ganancia"><span>Ganancia neta estimada total</span><strong>${dinero(resultado.ganancia)}</strong></div></section>`;
    } catch (error) { mensaje.textContent = error.message; }
  });
}
async function mostrarMisVentas(desde = fechaHoy().slice(0,7) + '-01', hasta = fechaHoy()) {
  const version = versionCarga;
  const ventas = await pedir(`/api/privado/misventas?desde=${desde}&hasta=${hasta}`);
  if (version !== versionCarga || seccion !== 'misventas') return;
  vista.innerHTML = `<form id="periodo-ventas" class="filtros"><label>Desde<input name="desde" type="date" value="${desde}" required></label><label>Hasta<input name="hasta" type="date" value="${hasta}" required></label><button class="boton">Consultar</button></form><section class="indicadores"><article><p>Mis ventas aprobadas</p><strong>${dinero(ventas.reduce((n,p) => n + Number(p.total),0))}</strong></article><article><p>Pedidos aprobados</p><strong>${ventas.length}</strong></article></section>${tabla([['id','Pedido'],['creado','Fecha',fechaCorta],['cliente','Cliente'],['estado','Estado',estado],['total','Venta',moneda]],ventas,null)}<p>Solo pedidos creados con tu usuario. No incluye cotizaciones ni pedidos cancelados.</p>`;
  vista.querySelector('#periodo-ventas').addEventListener('submit', async evento => {
    evento.preventDefault();
    try { await mostrarMisVentas(evento.target.elements.desde.value, evento.target.elements.hasta.value); } catch (error) { mensaje.textContent = error.message; }
  });
}
async function mostrarEmpleado(id, desde = fechaHoy().slice(0,7) + '-01', hasta = fechaHoy()) {
  const version = versionCarga;
  const datos = await pedir(`/api/privado/empleados/${id}/historial?desde=${desde}&hasta=${hasta}`);
  if (version !== versionCarga || seccion !== 'empleados') return;
  vista.innerHTML = `${boton('volver',0,'Volver a empleados')}<h2>${e(datos.empleado.nombre)}</h2><p>${e(datos.empleado.puesto)} · Salario mensual: ${dinero(datos.empleado.salario)}</p><form id="periodo-empleado" class="filtros"><label>Desde<input name="desde" type="date" value="${desde}" required></label><label>Hasta<input name="hasta" type="date" value="${hasta}" required></label><button class="boton">Consultar</button></form><section class="indicadores"><article><p>Ventas aprobadas</p><strong>${dinero(datos.ventas.reduce((n,p) => n + Number(p.total),0))}</strong></article><article><p>Salarios pagados</p><strong>${dinero(datos.pagos.reduce((n,p) => n + Number(p.monto),0))}</strong></article></section><h3>Ventas registradas con su usuario</h3>${tabla([['id','Pedido'],['creado','Fecha',fechaCorta],['estado','Estado',estado],['total','Venta',moneda]],datos.ventas,null)}<h3>Pagos de salario</h3>${tabla([['periodo','Mes',fechaCorta],['fecha','Fecha de pago',fechaCorta],['monto','Monto',moneda],['medio','Medio'],['cuenta','Referencia']],datos.pagos,null)}<p>Las ventas excluyen cotizaciones y cancelaciones. Los pagos se muestran por fecha del movimiento.</p>`;
  vista.querySelector('#periodo-empleado').addEventListener('submit', async evento => {
    evento.preventDefault();
    try { await mostrarEmpleado(id, evento.target.elements.desde.value, evento.target.elements.hasta.value); } catch (error) { mensaje.textContent = error.message; }
  });
}
async function abrirPedido(id) {
  const version = ++versionCarga;
  const pedidos = await pedir('/api/privado/pedidos');
  const pedido = pedidos.find(fila => fila.id === Number(id));
  if (!pedido) throw Error('Pedido no encontrado');
  const [seguimiento, partidas, documentos] = await Promise.all([
    pedir(`/api/seguimiento/${pedido.codigo}`),
    pedir(`/api/privado/pedidos/${pedido.id}/detalle`),
    usuario.rol === 'administrador' ? pedir(`/api/privado/documentos?pedido_id=${pedido.id}`) : []
  ]);
  if (version !== versionCarga) return;
  pedidoAbierto = pedido;
  pedido.enlace = seguimiento.enlace;
  vista.innerHTML = `<section class="acciones">${boton('volver',0,'Volver al listado')}<a class="secundario" href="${e(pedido.enlace)}" target="_blank" rel="noopener">Seguimiento del cliente</a>${boton('copiar-enlace',pedido.id,'Copiar enlace del cliente')}${boton('repetir',pedido.id,'Repetir pedido')}</section><article class="tarjeta"><p class="etiqueta">PEDIDO #${pedido.id}</p><h2>${e(pedido.cliente)}</h2>${estado(pedido.estado)}<p>Total ${dinero(pedido.total)} · Pagado ${dinero(pedido.pagado)} · Saldo ${dinero(pedido.saldo)}</p><p>Entrega: ${fechaCorta(pedido.fecha_prometida)} · Pago: ${fechaCorta(pedido.fecha_pago)} · Responsable: ${e(pedido.responsable || 'Sin asignar')}</p><p>${e(pedido.instrucciones)}</p>${tabla([['nombre','Producto'],['color','Color'],['talla','Talla'],['cantidad','Cantidad'],['nombre_personalizado','Personalización'],['precio','Precio unitario',moneda]],partidas,null)}<p>${pedido.vista_previa ? pedido.diseno_aprobado ? 'Diseño aprobado' : 'Requiere aprobación del diseño' : 'No solicita vista previa'}</p><section class="acciones">${siguientes[pedido.estado].filter(siguiente => usuario.rol === 'administrador' || siguiente !== 'pendiente').map(siguiente => `<button class="boton" data-accion="estado" data-id="${pedido.id}" data-estado="${siguiente}">${siguiente === 'pendiente' ? 'Aprobar pedido' : estados[siguiente]}</button>`).join('')}${usuario.rol === 'administrador' && pedido.vista_previa && !pedido.diseno_aprobado && ['cotizacion','pendiente'].includes(pedido.estado) ? boton('aprobar-diseno',pedido.id,'Aprobar diseño desde administración') : ''}${['pendiente','produccion'].includes(pedido.estado) ? `<button class="secundario" data-accion="avanzar" data-id="${pedido.id}" data-estado="${pedido.estado === 'pendiente' ? 'listo' : 'entregado'}">${pedido.estado === 'pendiente' ? 'Trabajo terminado: marcar listo' : 'Trabajo terminado y entregado'}</button>` : ''}${boton('programar',pedido.id,'Fecha y responsable')}${usuario.rol === 'administrador' ? boton('documento-pedido',pedido.id,'Emitir documento') + (!['cotizacion','cancelado'].includes(pedido.estado) && Number(pedido.saldo) > 0 ? boton('cobrar',pedido.id,'Registrar cobro') : '') : ''}</section><img class="previa-qr" src="/api/privado/pedidos/${pedido.id}/qr" alt="Código QR para que el cliente consulte su pedido #${pedido.id}"><section class="archivos">${seguimiento.archivos.map(archivo => `<a target="_blank" rel="noopener" href="/api/seguimiento/${pedido.codigo}/archivos/${archivo.id}">${archivo.es_previa ? 'Vista previa' : 'Referencia'}: ${e(archivo.nombre)}</a>`).join('')}</section>${['cotizacion','pendiente'].includes(pedido.estado) ? `<form id="subir-previa" class="filtros"><label>Vista previa para aprobación (PNG o JPEG, 5 MB)<input name="imagen" type="file" accept="image/png,image/jpeg" required></label><button class="secundario">Subir vista previa</button></form>` : ''}</article>`;
  if (documentos.length) vista.insertAdjacentHTML('beforeend', `<h3>Documentos del pedido</h3>${tabla([['id','Número'],['tipo','Tipo'],['total','Total',moneda]], documentos, d => `<a class="secundario" href="/api/privado/documentos/${d.id}/pdf" target="_blank" rel="noopener">Descargar PDF</a>`)}`);
  filas = pedidos;
  const subir = document.querySelector('#subir-previa');
  if (subir) subir.addEventListener('submit', async evento => { evento.preventDefault(); try { await pedir(`/api/privado/pedidos/${pedido.id}/archivos`,new FormData(subir)); await abrirPedido(pedido.id); } catch (error) { mensaje.textContent = error.message; } });
}
vista.addEventListener('click', async evento => {
  const objetivo = evento.target.closest('[data-accion]');
  if (!objetivo || objetivo.disabled) return;
  const { accion, id } = objetivo.dataset;
  if (accion === 'mes-anterior') { mesCalendario = mesDesplazado(mesCalendario, -1); return cargar(); }
  if (accion === 'mes-siguiente') { mesCalendario = mesDesplazado(mesCalendario, 1); return cargar(); }
  if (accion === 'mes-hoy') { mesCalendario = fechaHoy().slice(0, 7); return cargar(); }
  const fila = filas.find(fila => fila.id === Number(id));
  objetivo.disabled = true;
  try {
    if (accion === 'eliminar-contenido') {
      if (!confirm('¿Eliminar este contenido de la página? La imagen seguirá disponible en la biblioteca.')) return;
      objetivo.disabled = true;
      objetivo.textContent = 'Eliminando…';
      try {
        await pedir(`/api/privado/contenidos/${id}/eliminar`, {});
        await cargar();
        if (!mensaje.textContent) mensaje.textContent = 'Contenido eliminado correctamente.';
      } finally {
        objetivo.disabled = false;
        objetivo.textContent = 'Eliminar';
      }
      return;
    }
    if (accion === 'copiar-enlace') { await navigator.clipboard.writeText(fila.enlace); mensaje.textContent = 'Enlace del cliente copiado. Podés enviarlo por WhatsApp o correo.'; return; }
    if (accion === 'ir') { seccion = id; return cargar(); }
    if (accion === 'volver') return cargar();
    if (accion === 'detalle' || accion === 'abrir-pedido') return await abrirPedido(id);
    if (accion === 'nuevo' && seccion === 'pedidos') {
      const variantes = await pedir('/api/privado/variantes');
      let partidas;
      await abrirFormulario('Nuevo pedido', [['cliente_id','Cliente existente (opcional)','@clientes'],['nombre','Nombre del cliente nuevo'],['correo','Correo del cliente nuevo (opcional)','email'],['telefono','Teléfono del cliente nuevo'],['instrucciones','Instrucciones','area'],['fecha_prometida','Fecha prometida','date'],['vista_previa','Solicitar aprobación de diseño','checkbox']], {}, datos => pedir('/api/privado/pedidos', { ...datos, partidas: partidas.leer() }));
      partidas = montarPartidas(formulario, variantes);
      const cliente = formulario.elements.cliente_id;
      const actualizarCliente = () => {
        for (const nombre of ['nombre','correo','telefono']) {
          formulario.elements[nombre].disabled = !!cliente.value;
          formulario.elements[nombre].closest('label').hidden = !!cliente.value;
        }
        formulario.elements.nombre.required = !cliente.value;
      };
      cliente.addEventListener('change', actualizarCliente);
      actualizarCliente();
      return;
    }
    if (accion === 'cobrar' || accion === 'pagar-compra') {
      const cobro = accion === 'cobrar';
      return await abrirFormulario(cobro ? `Cobrar pedido #${id}` : `Pagar compra #${id}`, campos.movimientos, {tipo:cobro ? 'ingreso' : 'gasto', pedido_id:cobro ? id : '', compra_id:cobro ? '' : id, monto:cobro ? fila.saldo : Number((Number(fila.total) - Number(fila.pagado)).toFixed(2)), fecha:fechaHoy()}, datos => pedir('/api/privado/movimientos',datos));
    }
    if (accion === 'documento-pedido') return await abrirFormulario(`Documento del pedido #${id}`, campos.documentos, {pedido_id:id, tipo:'proforma'}, datos => pedir('/api/privado/documentos',datos));
    if (accion === 'nuevo' && seccion === 'compras') {
      const materiales = await pedir('/api/privado/inventario');
      let partidas;
      await abrirFormulario('Registrar compra', [['proveedor_id','Proveedor','@proveedores'],['factura','Factura del proveedor (opcional)'],['vencimiento','Fecha de pago (opcional)','date'],['notas','Notas (opcional)','area'],['recibida','Ya recibí estos materiales: sumarlos al inventario','checkbox']], {}, datos => pedir('/api/privado/compras',{...datos,partidas:partidas.leer()}));
      formulario.elements.proveedor_id.required = true;
      partidas = montarPartidas(formulario, materiales, {compra:true});
      agruparOpcionales(formulario,['factura','vencimiento','notas']);
      return;
    }
    if (accion === 'nuevo' || accion === 'editar') {
      const recurso = seccion;
      const definicion = accion === 'nuevo' && recurso === 'productos' ? [...campos.productos, ['crear_variante','Crear presentación estándar para cotizar este producto','checkbox'], ['existencias','Existencias iniciales (opcional)','number']] : accion === 'nuevo' && recurso === 'inventario' ? [...campos.inventario, ['existencias','Existencias iniciales (opcional)','number']] : campos[recurso];
      return await abrirFormulario(accion === 'nuevo' ? `Agregar · ${etiquetas[recurso]}` : 'Editar registro', definicion, fila || {}, datos => pedir(`/api/privado/${recurso}${fila ? `/${id}` : ''}`, datos, fila ? 'PATCH' : 'POST'));
    }
    if (accion === 'completar') { await pedir(`/api/privado/recordatorios/${id}`, {completado:!fila.completado}, 'PATCH'); return await cargar(); }
    // pedir el total fisico actual, no la cantidad q se quiere sumar al inventario
    if (accion === 'ajustar') return await abrirFormulario('Ajustar existencias', [['existencias','Existencia real','number']], fila, datos => pedir(`/api/privado/inventario/${id}/ajustar`,datos));
    if (accion === 'programar') return await abrirFormulario('Programar producción', [['fecha_prometida','Fecha prometida','date'],['fecha_pago','Fecha de pago','date'],['responsable_id','Responsable','@responsables'],['instrucciones','Instrucciones','area']], fila, datos => pedir(`/api/privado/pedidos/${id}`,datos,'PATCH'));
    if (accion === 'historial') {
      const pedidos = (await pedir('/api/privado/pedidos')).filter(pedido => pedido.cliente_id === Number(id));
      const saldoPedidos = pedidos.filter(pedido => !['cotizacion','cancelado'].includes(pedido.estado)).reduce((suma,pedido) => suma + Number(pedido.saldo),0);
      const saldoDeudas = totalDeudas(fila.deudas);
      vista.innerHTML = `<h2>${e(fila.nombre)}</h2><p>Saldo de pedidos: ${dinero(saldoPedidos)} · Deudas registradas: ${dinero(saldoDeudas)} · Total adeudado: ${dinero(saldoPedidos + saldoDeudas)} · Límite de crédito: ${dinero(fila.limite_credito)}</p><p>${e(fila.notas)}</p>${boton('volver',0,'Volver')}${tabla([['id','Pedido'],['estado','Estado',estado],['total','Total',moneda],['pagado','Pagado',moneda],['saldo','Saldo',moneda],['fecha_pago','Vencimiento',fechaCorta]],pedidos,pedido => boton('abrir-pedido',pedido.id,'Abrir'))}`; return;
    }
    if (accion === 'deudas') {
      const deudas = await pedir(`/api/privado/clientes/${id}/deudas`);
      const filaDeuda = (deuda = {}) => `<li class="fila-deuda"><label>¿Qué debe?<input name="descripcion" maxlength="300" value="${e(deuda.descripcion || '')}"></label><label>Monto en colones<input name="monto" type="number" min="0" max="999999999" step="0.01" value="${deuda.monto ?? ''}"></label><button class="secundario" type="button" data-quitar-deuda>Quitar</button></li>`;
      vista.innerHTML = `<h2>Deudas de ${e(fila.nombre)}</h2><p>Agregá todos los registros que necesités. La descripción y el monto son opcionales.</p>${boton('volver',0,'Volver a clientes')}<form id="editor-deudas" class="formulario"><ol id="lista-deudas">${deudas.map(filaDeuda).join('')}</ol><section class="acciones"><button id="agregar-deuda" class="secundario" type="button">Agregar deuda</button><button class="boton" type="submit">Guardar deudas</button></section><p id="mensaje-deudas" role="status"></p></form>`;
      const lista = vista.querySelector('#lista-deudas');
      vista.querySelector('#agregar-deuda').addEventListener('click', () => lista.insertAdjacentHTML('beforeend', filaDeuda()));
      lista.addEventListener('click', evento => { if (evento.target.closest('[data-quitar-deuda]')) evento.target.closest('li').remove(); });
      vista.querySelector('#editor-deudas').addEventListener('submit', async evento => {
        evento.preventDefault();
        const registros = [...lista.querySelectorAll('li')].map(item => ({ descripcion: item.querySelector('[name="descripcion"]').value.trim(), monto: item.querySelector('[name="monto"]').value })).filter(deuda => deuda.descripcion || deuda.monto !== '');
        const guardar = evento.target.querySelector('[type="submit"]');
        guardar.disabled = true;
        try {
          const guardadas = await pedir(`/api/privado/clientes/${id}/deudas`, { deudas: registros }, 'PATCH');
          lista.innerHTML = guardadas.deudas.map(filaDeuda).join('');
          document.querySelector('#mensaje-deudas').textContent = 'Deudas guardadas en la base de datos.';
        }
        catch (error) { document.querySelector('#mensaje-deudas').textContent = error.message; }
        finally { guardar.disabled = false; }
      });
      return;
    }
    if (accion === 'aprobar-diseno') { if (!confirm('¿Autorizar este diseño para producción según lo coordinado con el cliente?')) return; await pedir(`/api/privado/pedidos/${id}/aprobar-diseno`, {}); await abrirPedido(id); mensaje.textContent = 'Diseño aprobado desde administración. Ya puede iniciar producción si el pedido está confirmado.'; return; }
    if (accion === 'usuario-empleado') return await abrirFormulario('Crear usuario del empleado', [['correo','Correo de acceso','email'],['clave','Contraseña (mínimo 12 caracteres)','password'],['rol','Permisos',['operador','administrador']]], { correo: fila.correo, rol: 'operador' }, datos => pedir(`/api/privado/empleados/${id}/usuario`, datos));
    if (accion === 'pagar-salario') return await abrirFormulario(`Registrar salario · ${fila.nombre}`, [['periodo','Mes del salario','month'],['monto','Monto pagado (CRC)','number'],['fecha','Fecha del pago','date'],['medio','Medio de pago',['efectivo','banco','sinpe','tarjeta']],['cuenta','Cuenta o referencia']], { periodo: fechaHoy().slice(0,7), monto: fila.salario, fecha: fechaHoy(), medio: 'sinpe' }, datos => pedir(`/api/privado/empleados/${id}/pagar`, datos));
    if (accion === 'historial-empleado') return await mostrarEmpleado(id);
    if (accion === 'avanzar') { await pedir(`/api/privado/pedidos/${id}/avanzar`,{estado:objetivo.dataset.estado}); return await abrirPedido(id); }
    if (accion === 'estado') { if (objetivo.dataset.estado === 'cancelado' && !confirm('¿Cancelar el pedido y liberar sus reservas? Los pagos registrados se conservarán.')) return; await pedir(`/api/privado/pedidos/${id}`,{estado:objetivo.dataset.estado},'PATCH'); return await abrirPedido(id); }
    if (accion === 'repetir') { const pedido = await pedir(`/api/privado/pedidos/${id}/repetir`,{}); seccion = 'pedidos'; await cargar(); return await abrirPedido(pedido.id); }
    if (accion === 'recibir') await pedir(`/api/privado/compras/${id}/recibir`,{});
    if (accion === 'reintentar') await pedir(`/api/privado/notificaciones/${id}/reintentar`,{});
    if (accion === 'usuario') await pedir(`/api/privado/usuarios/${id}`,{activo:!fila.activo},'PATCH');
    await cargar();
  } catch (error) { mensaje.textContent = error.message; }
  finally { objetivo.disabled = false; }
});
try { await activar(await pedir('/api/privado/sesion')); } catch { document.querySelector('#acceso').hidden = false; }
