import { pedir, escapar as e, dinero } from './comun.js?v=20261017-panel-2';

const nombresMeses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const colores = ['#ffd500', '#4b8ff5', '#ed5965', '#c1cad8', '#8d91a3'];
const cantidad = valor => Number(valor).toLocaleString('es-CR', { maximumFractionDigits: 1 });
// no inventar un porcentaje cuando el año anterior no tiene ventas
export function variacion(actual, anterior) {
  return anterior > 0 ? (actual - anterior) / anterior * 100 : null;
}
function porcentaje(valor) { return valor === null ? 'Sin base previa' : `${valor > 0 ? '+' : ''}${cantidad(valor)} %`; }
function cambio(actual, anterior) {
  const valor = variacion(Number(actual), Number(anterior));
  return `<span class="variacion ${valor < 0 ? 'negativa' : valor > 0 ? 'positiva' : ''}">${porcentaje(valor)}</span>`;
}
function vacio() { return '<p class="grafico-vacio">Sin ventas registradas en este período.</p>'; }
function lineas(meses, anio) {
  const maximo = Math.max(...meses.flatMap(mes => [mes.ventas, mes.anterior]), 1);
  const x = indice => 76 + indice * 52;
  const y = valor => 220 - valor / maximo * 174;
  const puntos = campo => meses.map((mes, indice) => `${x(indice)},${y(mes[campo])}`).join(' ');
  const rejilla = Array.from({ length: 5 }, (_, indice) => {
    const monto = maximo * indice / 4;
    return `<line x1="76" x2="648" y1="${y(monto)}" y2="${y(monto)}" class="rejilla"/><text x="66" y="${y(monto) + 4}" text-anchor="end">${e(new Intl.NumberFormat('es-CR', { notation: 'compact', maximumFractionDigits: 1 }).format(monto))}</text>`;
  }).join('');
  return `<svg class="grafico-lineas" viewBox="0 0 690 264" role="img" aria-label="Ventas mensuales en colones de ${anio} y ${anio - 1}">${rejilla}<polyline points="${puntos('anterior')}" class="linea-anterior"/><polyline points="${puntos('ventas')}" class="linea-actual"/>${meses.map((mes, indice) => `<text x="${x(indice)}" y="247" text-anchor="middle">${nombresMeses[indice]}</text><circle cx="${x(indice)}" cy="${y(mes.ventas)}" r="4" class="punto-actual"><title>${nombresMeses[indice]} ${anio}: ${dinero(mes.ventas)}. ${anio - 1}: ${dinero(mes.anterior)}</title></circle>`).join('')}</svg>`;
}
function barrasMensuales(meses) {
  const valores = meses.map(mes => variacion(mes.ventas, mes.anterior));
  const maximo = Math.max(...valores.map(valor => Math.abs(valor || 0)), 1);
  return `<svg class="grafico-lineas" viewBox="0 0 690 240" role="img" aria-label="Variación porcentual por mes frente al año anterior"><line x1="56" x2="654" y1="112" y2="112" class="rejilla"/>${valores.map((valor, indice) => {
    const alto = Math.abs(valor || 0) / maximo * 65;
    const x = 66 + indice * 49;
    return `<rect x="${x}" y="${valor >= 0 ? 112 - alto : 112}" width="25" height="${alto}" class="${valor < 0 ? 'barra-negativa' : 'barra-positiva'}"><title>${nombresMeses[indice]}: ${porcentaje(valor)}</title></rect><text x="${x + 12}" y="${valor < 0 ? 128 + alto : 101 - alto}" text-anchor="middle">${valor === null ? '—' : `${Math.round(valor)}%`}</text><text x="${x + 12}" y="218" text-anchor="middle">${nombresMeses[indice]}</text>`;
  }).join('')}</svg>`;
}
function dona(productos) {
  const total = productos.reduce((suma, producto) => suma + Number(producto.unidades), 0);
  if (!total) return vacio();
  let recorrido = 0;
  const arcos = productos.map((producto, indice) => {
    const parte = Number(producto.unidades) / total * 100;
    const arco = `<circle cx="110" cy="110" r="78" pathLength="100" fill="none" stroke="${colores[indice]}" stroke-width="24" stroke-dasharray="${parte} ${100 - parte}" stroke-dashoffset="${-recorrido}" transform="rotate(-90 110 110)"><title>${e(producto.nombre)}: ${cantidad(producto.unidades)} unidades (${cantidad(parte)} % del top 5)</title></circle>`;
    recorrido += parte;
    return arco;
  }).join('');
  return `<section class="distribucion-productos"><svg viewBox="0 0 220 220" role="img" aria-label="Participación en unidades de los cinco productos más vendidos">${arcos}<text x="110" y="108" text-anchor="middle" class="total-dona">${cantidad(total)}</text><text x="110" y="132" text-anchor="middle">unidades · top 5</text></svg><ol class="leyenda-productos">${productos.map((producto, indice) => `<li><span class="color-serie serie-${indice}" aria-hidden="true"></span><span>${e(producto.nombre)}<small>${dinero(producto.ventas)} en ventas</small></span><strong>${cantidad(producto.unidades)}</strong></li>`).join('')}</ol></section>`;
}
function trimestres(meses) {
  const valores = Array.from({ length: 4 }, (_, indice) => meses.slice(indice * 3, indice * 3 + 3).reduce((suma, mes) => suma + mes.ventas - mes.anterior, 0));
  const maximo = Math.max(...valores.map(Math.abs), 1);
  return `<section class="barras-trimestres">${valores.map((valor, indice) => `<article><p><span>T${indice + 1}</span><strong class="${valor < 0 ? 'negativa' : ''}">${valor > 0 ? '+' : ''}${dinero(valor)}</strong></p><svg viewBox="0 0 300 12" role="img" aria-label="Trimestre ${indice + 1}: diferencia de ${e(dinero(valor))}"><rect width="300" height="12" rx="6" class="fondo-barra"/><rect width="${Math.abs(valor) / maximo * 300}" height="12" rx="6" class="${valor < 0 ? 'barra-negativa' : 'barra-positiva'}"/></svg></article>`).join('')}</section>`;
}
function tablaMeses(meses, anio) {
  return `<details class="detalle-estadistico"><summary>Ver cifras mensuales</summary><section class="tabla"><table><thead><tr><th>Mes</th><th>Ventas ${anio}</th><th>Ventas ${anio - 1}</th><th>Variación</th></tr></thead><tbody>${meses.map((mes, indice) => `<tr><td>${nombresMeses[indice]}</td><td>${dinero(mes.ventas)}</td><td>${dinero(mes.anterior)}</td><td>${cambio(mes.ventas, mes.anterior)}</td></tr>`).join('')}</tbody></table></section></details>`;
}
export async function mostrarEstadisticas(vista, anio = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).slice(0, 4))) {
  const datos = await pedir(`/api/privado/estadisticas?anio=${anio}`);
  // no dibujar esta respuesta si el usuario ya se fue a otra seccion
  if (vista.dataset.seccion !== 'estadisticas') return;
  const resumen = datos.resumen;
  const diferencia = resumen.ventas - resumen.anterior;
  const margen = resumen.ventas - resumen.costo;
  const anios = [...new Set([...datos.anios, anio, anio - 1])].filter(valor => valor >= 2000).sort((a, b) => b - a);
  const indicadores = [
    ['Ventas aprobadas', dinero(resumen.ventas), `${resumen.pedidos} pedidos en ${anio}`],
    ['Ventas del año anterior', dinero(resumen.anterior), `Enero a diciembre de ${anio - 1}`],
    ['Diferencia de ventas', dinero(diferencia), cambio(resumen.ventas, resumen.anterior)],
    ['Margen bruto estimado', dinero(margen), 'Ventas menos costo estimado de producción']
  ];
  const categoriasActuales = datos.categorias.filter(categoria => Number(categoria.unidades) > 0);
  const maxUnidades = Math.max(...categoriasActuales.map(categoria => Number(categoria.unidades)), 1);
  vista.innerHTML = `<section class="estadisticas"><header class="hero-estadisticas"><div><p class="etiqueta">PANEL DE RENDIMIENTO</p><h2>Estadísticas del negocio</h2><p>Ventas, costos y actividad en una sola vista.</p></div><span class="periodo-estadisticas">${anio} <i>vs.</i> ${anio - 1}</span></header><form id="filtro-estadisticas" class="filtros filtro-estadisticas"><label>Año de análisis<select name="anio">${anios.map(valor => `<option value="${valor}" ${valor === anio ? 'selected' : ''}>${valor}</option>`).join('')}</select></label><button class="boton">Consultar</button><p>Comparación anual completa<br><strong>${anio} frente a ${anio - 1}</strong></p><output id="error-estadisticas" role="status"></output></form>
    <section class="indicadores">${indicadores.map(([nombre, valor, nota]) => `<article><p>${nombre}</p><strong>${valor}</strong><small>${nota}</small></article>`).join('')}</section>
    <section class="cifras-estadisticas" aria-label="Indicadores del año"><p><strong>${datos.clientes}</strong>Clientes con pedidos</p><p><strong>${dinero(resumen.pedidos ? resumen.ventas / resumen.pedidos : 0)}</strong>Venta media por pedido</p><p><strong>${categoriasActuales.length}</strong>Categorías vendidas</p><p><strong>${datos.inventario.bajo} / ${datos.inventario.variantes}</strong>Registros con stock bajo · hoy</p></section>
    <section class="graficos-estadisticas"><article class="tarjeta"><h2>Evolución de ventas</h2><p class="leyenda-lineas"><span>${anio}</span><span>${anio - 1}</span><small>Importes en CRC</small></p>${lineas(datos.meses, anio)}${!resumen.ventas && !resumen.anterior ? vacio() : ''}${tablaMeses(datos.meses, anio)}</article><article class="tarjeta"><h2>Los 5 productos más vendidos</h2><p class="nota-grafico">Distribución por unidades dentro del top 5.</p>${dona(datos.productos)}</article>
    <article class="tarjeta"><h2>Variación mensual de ventas</h2><p class="nota-grafico">Frente al mismo mes de ${anio - 1}. — indica que no hay base previa.</p>${barrasMensuales(datos.meses)}</article><article class="tarjeta"><h2>Diferencia por trimestre</h2><p class="nota-grafico">Ventas de ${anio} menos ventas de ${anio - 1}.</p>${trimestres(datos.meses)}</article>
    <article class="tarjeta"><h2>Unidades vendidas por categoría</h2>${categoriasActuales.length ? `<section class="categorias-estadisticas">${categoriasActuales.map(categoria => `<article><p><span>${e(categoria.categoria)}</span><strong>${cantidad(categoria.unidades)}</strong></p><svg viewBox="0 0 500 14" role="img" aria-label="${e(categoria.categoria)}: ${cantidad(categoria.unidades)} unidades"><rect width="500" height="14" rx="5" class="fondo-barra"/><rect width="${Number(categoria.unidades) / maxUnidades * 500}" height="14" rx="5" class="barra-positiva"/></svg></article>`).join('')}</section>` : vacio()}</article><article class="tarjeta"><h2>Movimientos de efectivo</h2><dl class="efectivo-estadisticas"><dt>Ingresos cobrados</dt><dd>${dinero(datos.efectivo.cobros)}</dd><dt>Gastos registrados</dt><dd>${dinero(datos.efectivo.gastos)}</dd><dt>Comisiones</dt><dd>${dinero(datos.efectivo.comisiones)}</dd><dt>Flujo neto</dt><dd>${dinero(Number(datos.efectivo.cobros) - Number(datos.efectivo.gastos) - Number(datos.efectivo.comisiones))}</dd></dl><p class="nota-grafico">Incluye los salarios registrados como gasto, según la fecha del pago. Una venta pendiente de pago no cuenta como ingreso cobrado.</p></article></section>
    <article class="tarjeta"><h2>Rendimiento por categoría</h2>${datos.categorias.length ? `<section class="tabla"><table><thead><tr><th>Categoría</th><th>Ventas ${anio}</th><th>Ventas ${anio - 1}</th><th>Variación</th><th>Margen estimado ${anio}</th></tr></thead><tbody>${datos.categorias.map(categoria => `<tr><td>${e(categoria.categoria)}</td><td>${dinero(categoria.ventas)}</td><td>${dinero(categoria.anterior)}</td><td>${cambio(categoria.ventas, categoria.anterior)}</td><td>${dinero(categoria.margen)}</td></tr>`).join('')}</tbody></table></section>` : vacio()}</article>
    <article class="tarjeta"><h2>Ventas por empleado y usuario</h2><section class="tabla"><table><thead><tr><th>Empleado / usuario</th><th>Puesto</th><th>Pedidos aprobados</th><th>Ventas</th></tr></thead><tbody>${datos.vendedores.map(fila => `<tr><td>${e(fila.nombre)}</td><td>${e(fila.puesto)}</td><td>${fila.pedidos}</td><td>${dinero(fila.ventas)}</td></tr>`).join('')}</tbody></table></section>${datos.vendedores.length ? '' : vacio()}</article>
    <p class="nota-estadisticas">Las ventas se agrupan por fecha de creación del pedido y excluyen cotizaciones y cancelaciones. La comparación usa años completos; un año en curso puede tener meses sin actividad. El margen es estimado y no descuenta gastos generales ni comisiones. Las categorías corresponden al catálogo actual.</p></section>`;
  vista.querySelector('#filtro-estadisticas').addEventListener('submit', async evento => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const boton = formulario.querySelector('button');
    boton.disabled = true;
    try { await mostrarEstadisticas(vista, Number(formulario.elements.anio.value)); }
    catch (error) { formulario.querySelector('output').textContent = error.message; }
    finally { boton.disabled = false; }
  });
}
