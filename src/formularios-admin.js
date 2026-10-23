import { dinero } from './comun.js?v=20261017-panel-2';

export const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function activarBusquedas(formulario) {
  formulario.querySelectorAll('select:not([multiple])').forEach(select => {
    if (select.options.length < 9 || select.dataset.buscable) return;
    select.dataset.buscable = 'true';
    const opciones = [...select.options].map(o => o.cloneNode(true));
    const etiqueta = document.createElement('span');
    etiqueta.className = 'busqueda-selector';
    etiqueta.textContent = 'Buscar en la lista';
    const buscador = document.createElement('input');
    buscador.type = 'search';
    buscador.setAttribute('aria-label', `Buscar opciones de ${select.closest('label')?.firstChild?.textContent || 'la lista'}`);
    buscador.placeholder = 'Nombre o número…';
    etiqueta.append(buscador);
    select.before(etiqueta);
    buscador.addEventListener('input', () => {
      const valor = select.value;
      const palabras = normalizar(buscador.value).split(/\s+/).filter(Boolean);
      select.replaceChildren(...opciones.filter(o => !o.value || o.value === valor || palabras.every(p => normalizar(o.textContent).includes(p))).map(o => o.cloneNode(true)));
      select.value = valor;
    });
  });
}

export function agruparOpcionales(formulario, nombres) {
  const etiquetas = nombres.map(nombre => formulario.elements[nombre]?.closest('label')).filter(Boolean);
  if (!etiquetas.length) return;
  const detalles = document.createElement('details');
  detalles.className = 'datos-opcionales';
  detalles.innerHTML = '<summary>Más datos (opcional)</summary><div class="campos-opcionales"></div>';
  etiquetas[0].before(detalles);
  etiquetas.forEach(etiqueta => detalles.querySelector('div').append(etiqueta));
  detalles.addEventListener('invalid', () => { detalles.open = true; }, true);
}

export function activarMovimiento(formulario, pedidos, compras) {
  const tipo = formulario.elements.tipo;
  const pedido = formulario.elements.pedido_id;
  const compra = formulario.elements.compra_id;
  const concepto = formulario.elements.concepto;
  const monto = formulario.elements.monto;
  monto.required = true;
  monto.min = '0.01';
  const ayuda = document.createElement('p');
  ayuda.setAttribute('role', 'status');
  monto.closest('label').after(ayuda);
  function actualizar(sugerir = false) {
    const ingreso = tipo.value === 'ingreso';
    pedido.disabled = !ingreso;
    compra.disabled = ingreso;
    pedido.closest('label').hidden = !ingreso;
    compra.closest('label').hidden = ingreso;
    const seleccionado = ingreso ? pedidos.find(p => String(p.id) === pedido.value) : compras.find(c => String(c.id) === compra.value);
    const saldo = seleccionado ? Number((ingreso ? Number(seleccionado.saldo) : Number(seleccionado.total) - Number(seleccionado.pagado)).toFixed(2)) : null;
    concepto.required = !seleccionado;
    concepto.placeholder = seleccionado ? ingreso ? `Cobro del pedido #${seleccionado.id}` : `Pago de compra #${seleccionado.id}` : 'Ej.: compra de tinta o venta de mostrador';
    if (saldo !== null) monto.max = String(Math.max(0, saldo)); else monto.removeAttribute('max');
    if (sugerir && saldo !== null) monto.value = String(Math.max(0, saldo));
    ayuda.textContent = saldo === null ? 'Pedido y compra son opcionales. La fecha vacía usa hoy; comisión e impuesto vacíos usan cero.' : `Saldo pendiente: ${dinero(saldo)}. Podés registrar un abono menor; el concepto se completa automáticamente si lo dejás vacío.`;
  }
  tipo.addEventListener('change', () => { if (tipo.value === 'ingreso') compra.value = ''; else pedido.value = ''; actualizar(); });
  pedido.addEventListener('change', () => actualizar(true));
  compra.addEventListener('change', () => actualizar(true));
  actualizar();
}
