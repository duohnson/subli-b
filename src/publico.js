import { pedir, escapar, dinero, fechaCorta, datosFormulario } from './comun.js?v=20261017-panel-2';
const productos = document.querySelector('#productos');
const estado = document.querySelector('#estado-catalogo');
const filtros = document.querySelector('#filtros');
const busquedaCabecera = document.querySelector('#busqueda-cabecera');
const dialogo = document.querySelector('#personalizar');
const formulario = document.querySelector('#solicitud');
const mensaje = document.querySelector('#mensaje-solicitud');
const detalle = document.querySelector('#detalle-seguimiento');
let catalogo = [];
let paginaCatalogo = 1;
let elegido;
let codigoActual;
let solicitudCreada;
let pedidoActual;
// tomar el telefono del enlace de contacto para cambiarlo solo en el HTML
const whatsapp = new URL(document.querySelector('#contacto a[href^="https://wa.me/"]').href).pathname.slice(1);

function mostrarCatalogo() {
  const terminos = normalizarTexto(filtros.elements.buscar.value).split(/\s+/).filter(Boolean);
  const categoria = filtros.elements.categoria.value;
  const visibles = catalogo.filter(producto => {
    const palabras = normalizarTexto(`${producto.nombre} ${producto.descripcion}`).split(/\s+/).filter(Boolean);
    return (!categoria || producto.categoria === categoria) && terminos.every(termino => palabras.some(palabra => palabra.includes(termino) || palabra.replace(/s$/, '') === termino.replace(/s$/, '')));
  });
  const paginas = Math.ceil(visibles.length / 10);
  paginaCatalogo = Math.min(paginaCatalogo, paginas || 1);
  const inicio = (paginaCatalogo - 1) * 10;
  mostrarPaginas(document.querySelector('#paginas-catalogo'), paginas, paginaCatalogo);
  estado.textContent = visibles.length ? `${visibles.length} productos disponibles · Mostrando ${inicio + 1}–${Math.min(inicio + 10, visibles.length)}` : 'No hay productos disponibles con estos filtros. Contáctenos para consultar otras opciones.';
  productos.innerHTML = visibles.slice(inicio, inicio + 10).map(producto => `<article class="producto">${imagenesProducto(producto).length ? `<button class="foto-producto" type="button" data-galeria="${producto.id}" aria-label="Ver imágenes de ${escapar(producto.nombre)}"><img src="${escapar(imagenesProducto(producto)[0])}" alt="${escapar(producto.nombre)}" loading="lazy"></button>` : '<p class="sin-foto">Subli’B</p>'}<p class="etiqueta">${escapar(producto.categoria)}</p><h3>${escapar(producto.nombre)}</h3><p class="producto-descripcion">${escapar(producto.descripcion)}</p><div class="producto-precio"><strong>${dinero(producto.precio)}</strong>${producto.promocion ? `<p class="promocion">${escapar(producto.promocion)}</p>` : ''}</div><p>${producto.variantes.reduce((total, variante) => total + Number(variante.disponible), 0)} unidades disponibles</p><button class="boton" data-producto="${producto.id}" ${producto.variantes.length ? '' : 'disabled'}>${producto.personalizable ? 'Personalizar y cotizar' : 'Solicitar cotización'}</button></article>`).join('');
}
function mostrarPaginas(navegacion, total, actual) {
  navegacion.hidden = total < 2;
  navegacion.innerHTML = Array.from({ length: total }, (_, indice) => `<button class="secundario" type="button" data-pagina="${indice + 1}" aria-label="Página ${indice + 1}" ${indice + 1 === actual ? 'aria-current="page"' : ''}>${indice + 1}</button>`).join('');
}
function imagenesProducto(producto) {
  return [...new Set([producto.imagen, ...(producto.imagenes || [])].filter(Boolean).map(imagen => imagen.startsWith('src/') ? '/' + imagen : imagen))];
}
function normalizarTexto(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}
if (filtros) {
  const galeria = document.querySelector('#galeria-producto');
  let imagenes = [];
  let posicion = 0;
  function mostrarImagen(direccion = 0) {
    posicion = (posicion + direccion + imagenes.length) % imagenes.length;
    const imagen = document.querySelector('#imagen-producto');
    imagen.src = imagenes[posicion];
    imagen.alt = `${document.querySelector('#titulo-galeria-producto').textContent} · Imagen ${posicion + 1}`;
    document.querySelector('#posicion-imagen').textContent = `${posicion + 1} / ${imagenes.length}`;
    galeria.querySelectorAll('[data-direccion]').forEach(boton => { boton.hidden = imagenes.length < 2; });
  }
  galeria.querySelector('.cerrar').addEventListener('click', () => galeria.close());
  galeria.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-direccion]');
    if (boton) mostrarImagen(Number(boton.dataset.direccion));
  });
  galeria.addEventListener('keydown', evento => {
    if (!['ArrowLeft', 'ArrowRight'].includes(evento.key)) return;
    evento.preventDefault();
    mostrarImagen(evento.key === 'ArrowLeft' ? -1 : 1);
  });
  productos.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-galeria]');
    if (!boton) return;
    const producto = catalogo.find(producto => producto.id === Number(boton.dataset.galeria));
    imagenes = imagenesProducto(producto);
    posicion = 0;
    document.querySelector('#titulo-galeria-producto').textContent = producto.nombre;
    mostrarImagen();
    galeria.showModal();
  });
  document.querySelector('#paginas-catalogo').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-pagina]');
    if (!boton) return;
    paginaCatalogo = Number(boton.dataset.pagina);
    mostrarCatalogo();
    document.querySelector(`#paginas-catalogo [data-pagina="${paginaCatalogo}"]`).focus({ preventScroll: true });
    document.querySelector('#catalogo').scrollIntoView({ block: 'start' });
  });
  filtros.elements.buscar.addEventListener('input', () => {
    paginaCatalogo = 1;
    busquedaCabecera.elements.buscar.value = filtros.elements.buscar.value;
    mostrarCatalogo();
  });
  filtros.elements.categoria.addEventListener('input', () => { paginaCatalogo = 1; mostrarCatalogo(); });
  busquedaCabecera.elements.buscar.addEventListener('input', () => {
    paginaCatalogo = 1;
    filtros.elements.buscar.value = busquedaCabecera.elements.buscar.value;
    mostrarCatalogo();
  });
  filtros.addEventListener('submit', evento => evento.preventDefault());
  busquedaCabecera.addEventListener('submit', evento => {
    evento.preventDefault();
    document.querySelector('#catalogo').scrollIntoView({ behavior: 'smooth' });
  });
  productos.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-producto]');
    if (!boton) return;
    elegido = catalogo.find(producto => producto.id === Number(boton.dataset.producto));
    solicitudCreada = null;
    formulario.reset();
    formulario.querySelector('button').disabled = false;
    mensaje.textContent = '';
    document.querySelector('#titulo-personalizar').textContent = elegido.nombre;
    formulario.elements.variante_id.innerHTML = elegido.variantes.map(variante => `<option value="${variante.id}">${escapar([variante.color, variante.talla].filter(Boolean).join(' · ') || 'Presentación estándar')} · ${variante.disponible} disponibles</option>`).join('');
    formulario.elements.nombre_personalizado.disabled = !elegido.personalizable;
    actualizarTotal();
    dialogo.showModal();
  });
  function actualizarTotal() { document.querySelector('#total-solicitud').textContent = `Precio de referencia: ${dinero(elegido.precio * Number(formulario.elements.cantidad.value || 1))}`; }
  formulario.elements.cantidad.addEventListener('input', actualizarTotal);
  dialogo.querySelector('.cerrar').addEventListener('click', () => dialogo.close());
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const boton = formulario.querySelector('button');
    boton.disabled = true;
    try {
      const imagen = formulario.elements.imagen.files[0];
      if (imagen && imagen.size > 5 * 1024 * 1024) throw Error('La imagen supera los 5 MB');
      const datos = datosFormulario(formulario);
      // crear el pedido una sola vez aunque despues falle la subida de la imagen
      if (!solicitudCreada) solicitudCreada = await pedir('/api/solicitudes', { ...datos, imagen: undefined, partidas: [{ variante_id: datos.variante_id, cantidad: datos.cantidad, nombre_personalizado: datos.nombre_personalizado }] });
      codigoActual = solicitudCreada.codigo;
      mensaje.textContent = `Pedido #${solicitudCreada.id} creado. La administración debe aprobarlo desde el panel.`;
      location.hash = `seguimiento=${codigoActual}`;
      if (imagen) {
        const archivo = new FormData(); archivo.append('imagen', imagen);
        await pedir(`/api/seguimiento/${codigoActual}/archivos`, archivo);
      }
      dialogo.close();
      await consultar(codigoActual);
      document.querySelector('#seguimiento').scrollIntoView();
    } catch (error) { mensaje.textContent = `${solicitudCreada ? `Solicitud creada. Código: ${solicitudCreada.codigo}. ` : ''}${error.message}`; boton.disabled = false; }
  });
}
async function consultar(codigo) {
  codigoActual = codigo;
  document.querySelector('#consultar').elements.codigo.value = codigo;
  try {
    const pedido = await pedir(/^\d+$/.test(codigo) ? `/api/seguimiento-numero/${encodeURIComponent(codigo)}` : `/api/seguimiento/${encodeURIComponent(codigo)}`);
    pedidoActual = pedido;
    const nombres = { cotizacion: 'Cotización por revisar', pendiente: 'Pedido confirmado', produccion: 'En producción', listo: 'Listo para entregar', entregado: 'Entregado', cancelado: 'Cancelado' };
    const mensajePago = `Hola, terminé el pedido #${pedido.id} en Subli’B. Quiero realizar el pago para que puedan continuar y procesarlo.`;
    detalle.innerHTML = `<article class="tarjeta"><p class="etiqueta">PEDIDO #${pedido.id}</p><h3>${nombres[pedido.estado]}</h3><p>Referencia de seguimiento: <strong>#${pedido.id}</strong></p>${pedido.estado === 'cotizacion' ? `<p>Para continuar y procesar el pedido, haga clic en el botón para coordinar el pago por WhatsApp de Subli’B. La administración aprobará el pedido desde el panel.</p><a class="boton" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(mensajePago)}" target="_blank" rel="noopener noreferrer">Ir a realizar el pago por WhatsApp</a>` : `<a class="boton" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero consultar sobre el pedido #${pedido.id}`)}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>`}<section class="archivos">${pedido.archivos.map(archivo => `<a href="/api/seguimiento/${encodeURIComponent(codigo)}/archivos/${archivo.id}" target="_blank" rel="noopener">${archivo.es_previa ? 'Vista previa' : 'Referencia'}: ${escapar(archivo.nombre)}</a>`).join('')}</section>${formularioPedido(pedido)}${pedido.vista_previa ? `<p>${pedido.diseno_aprobado ? 'Diseño aprobado para producción.' : pedido.archivos.some(archivo => archivo.es_previa) ? 'Diseño pendiente de aprobación. Revise la vista previa y apruébela con el botón de abajo.' : 'Falta que el negocio publique la vista previa. También puede coordinar la aprobación directamente con administración.'}</p>` : ''}${!pedido.modo_publico && !pedido.diseno_aprobado && pedido.archivos.some(archivo => archivo.es_previa) && ['cotizacion','pendiente'].includes(pedido.estado) ? '<button class="boton" id="aprobar-diseno">Aprobar este diseño para producción</button>' : ''}</article>`;
  } catch (error) { detalle.textContent = error.message; }
}
function formularioPedido(pedido) {
  if (pedido.modo_publico) return '<p>Para ver o editar los detalles, abra el enlace privado de seguimiento que recibió al enviar el pedido.</p>';
  const editable = ['cotizacion', 'pendiente'].includes(pedido.estado);
  return `<form id="editar-pedido" class="formulario"><h3>Detalle del pedido</h3>${pedido.partidas.map(partida => `<fieldset><legend>${escapar(partida.nombre)} · ${escapar([partida.color, partida.talla].filter(Boolean).join(' / '))}</legend><p>Precio unitario: ${dinero(partida.precio)}</p><label>Cantidad<input name="cantidad-${partida.id}" type="number" min="1" max="10000" step="1" value="${partida.cantidad}" required ${pedido.estado !== 'cotizacion' ? 'disabled' : ''}></label><label>Personalización<input name="nombre-${partida.id}" maxlength="300" value="${escapar(partida.nombre_personalizado)}" ${editable ? '' : 'disabled'}></label></fieldset>`).join('')}<label>Instrucciones<textarea name="instrucciones" maxlength="3000" ${editable ? '' : 'disabled'}>${escapar(pedido.instrucciones)}</textarea></label>${editable ? '<button class="boton" type="submit">Guardar cambios</button>' : '<p>Este pedido ya no permite cambios.</p>'}${pedido.estado === 'pendiente' ? '<p><strong>Pedido aprobado por Subli’B.</strong> Para cambiar las cantidades confirmadas, contacte al negocio.</p>' : ''}<p id="mensaje-edicion" role="status"></p></form>`;
}
detalle.addEventListener('submit', async evento => {
  if (evento.target.id !== 'editar-pedido') return;
  evento.preventDefault();
  const formulario = evento.target;
  const boton = formulario.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    const partidas = pedidoActual.partidas.map(partida => ({ id: partida.id, cantidad: formulario.elements[`cantidad-${partida.id}`].value, nombre_personalizado: formulario.elements[`nombre-${partida.id}`].value }));
    const resultado = await pedir(`/api/seguimiento/${encodeURIComponent(codigoActual)}`, { partidas, instrucciones: formulario.elements.instrucciones.value }, 'PATCH');
    await consultar(codigoActual);
    document.querySelector('#mensaje-edicion').textContent = resultado.mensaje;
  } catch (error) { document.querySelector('#mensaje-edicion').textContent = error.message; boton.disabled = false; }
});
document.querySelector('#consultar').addEventListener('submit', evento => { evento.preventDefault(); consultar(evento.target.elements.codigo.value.trim()); });
detalle.addEventListener('click', async evento => {
  const accion = evento.target.id === 'aprobar-diseno' ? 'aprobar' : null;
  if (!accion) return;
  const formulario = document.querySelector('#editar-pedido');
  const cambiado = formulario.elements.instrucciones.value !== pedidoActual.instrucciones || pedidoActual.partidas.some(partida => Number(formulario.elements[`cantidad-${partida.id}`].value) !== partida.cantidad || formulario.elements[`nombre-${partida.id}`].value !== partida.nombre_personalizado);
  if (cambiado) { document.querySelector('#mensaje-edicion').textContent = 'Guarde los cambios antes de continuar.'; return; }
  evento.target.disabled = true;
  try {
    await pedir(`/api/seguimiento/${encodeURIComponent(codigoActual)}/${accion}`, {});
    await consultar(codigoActual);
  } catch (error) { document.querySelector('#mensaje-edicion').textContent = error.message; evento.target.disabled = false; }
});
if (filtros) {
  try {
    catalogo = await pedir('/api/catalogo');
    filtros.elements.categoria.innerHTML += [...new Set(catalogo.map(producto => producto.categoria))].sort().map(categoria => `<option>${escapar(categoria)}</option>`).join('');
    filtros.elements.buscar.value = new URLSearchParams(location.search).get('buscar') || '';
    busquedaCabecera.elements.buscar.value = filtros.elements.buscar.value;
    mostrarCatalogo();
  } catch { estado.textContent = 'No pudimos cargar el catálogo. Intente más tarde o contáctenos por WhatsApp.'; }
}
if (document.querySelector('.galeria')) {
  try {
    const contenidos = await pedir('/api/contenidos');
    const galeria = document.querySelector('.galeria');
    const trabajos = contenidos.filter(contenido => contenido.seccion === 'galeria');
    const trabajosPorPagina = 9;
    const paginas = Math.ceil(trabajos.length / trabajosPorPagina);
    const navegacion = document.querySelector('#paginas-trabajos');
    const pausa = document.querySelector('#pausar-trabajos');
    const seccion = galeria.closest('.trabajos');
    let pagina = 1;
    let intervalo;
    let pausado = matchMedia('(prefers-reduced-motion: reduce)').matches;
    mostrarPaginas(navegacion, paginas, pagina);
    pausa.hidden = paginas < 2;
    function mostrarTrabajos() {
      galeria.innerHTML = trabajos.slice((pagina - 1) * trabajosPorPagina, pagina * trabajosPorPagina).map(contenido => `<img src="${escapar(contenido.imagen)}" alt="${escapar(contenido.nombre)}" loading="lazy" decoding="async" width="1600" height="1600">`).join('');
      document.querySelector('#estado-galeria').textContent = trabajos.length ? `Página ${pagina} de ${paginas} · ${trabajos.length} trabajos realizados` : 'Pronto compartiremos nuevos trabajos.';
      navegacion.querySelectorAll('[data-pagina]').forEach(boton => {
        if (Number(boton.dataset.pagina) === pagina) boton.setAttribute('aria-current', 'page');
        else boton.removeAttribute('aria-current');
      });
    }
    function iniciarTrabajos() {
      clearInterval(intervalo);
      pausa.textContent = pausado ? 'Reanudar cambio automático' : 'Pausar cambio automático';
      if (paginas < 2 || pausado || document.hidden || seccion.matches(':hover') || seccion.contains(document.activeElement)) return;
      intervalo = setInterval(() => { pagina = pagina % paginas + 1; mostrarTrabajos(); }, 5000);
    }
    navegacion.addEventListener('click', evento => {
      const boton = evento.target.closest('[data-pagina]');
      if (!boton) return;
      pagina = Number(boton.dataset.pagina);
      mostrarTrabajos();
      iniciarTrabajos();
    });
    pausa.addEventListener('click', () => { pausado = !pausado; iniciarTrabajos(); });
    seccion.addEventListener('mouseenter', iniciarTrabajos);
    seccion.addEventListener('mouseleave', iniciarTrabajos);
    seccion.addEventListener('focusin', iniciarTrabajos);
    seccion.addEventListener('focusout', () => setTimeout(iniciarTrabajos, 0));
    document.addEventListener('visibilitychange', iniciarTrabajos);
    mostrarTrabajos();
    iniciarTrabajos();
    const portada = document.querySelector('.destacadas');
    portada.querySelectorAll('img').forEach(imagen => imagen.remove());
    const destacadas = contenidos.filter(contenido => contenido.seccion === 'portada');
    destacadas.forEach((contenido, indice) => {
      const imagen = document.createElement('img'); imagen.src = contenido.imagen; imagen.alt = contenido.nombre;
      if (!indice) imagen.className = 'activa'; else imagen.setAttribute('aria-hidden','true');
      portada.insertBefore(imagen, portada.querySelector('figcaption'));
    });
    portada.hidden = !destacadas.length;
    document.querySelector('#numero').textContent = `01 / ${String(destacadas.length).padStart(2,'0')}`;
    window.dispatchEvent(new Event('contenido-actualizado'));
  } catch { document.querySelector('#estado-galeria').textContent = 'No pudimos cargar los trabajos. Intente más tarde.'; }
}
function leerSeguimiento() { if (location.hash.startsWith('#seguimiento=')) { consultar(location.hash.slice(13)); document.querySelector('#seguimiento').scrollIntoView(); } }
window.addEventListener('hashchange', leerSeguimiento);
leerSeguimiento();
