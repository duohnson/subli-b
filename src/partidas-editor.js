import { activarBusquedas } from './formularios-admin.js?v=20261023-2';
import { escapar as e, dinero } from './comun.js?v=20261017-panel-2';

export function montarPartidas(formulario, variantes = null, { compra = false } = {}) {
  const grupo = document.createElement('fieldset');
  grupo.className = 'editor-partidas';
  grupo.innerHTML = '<legend>Partidas</legend><div data-filas></div><button type="button" class="secundario" data-agregar>Agregar partida</button><p data-total role="status"></p>';
  formulario.querySelector('[type=submit]').before(grupo);
  const lista = grupo.querySelector('[data-filas]');
  function agregar() {
    if (lista.children.length >= 30) return;
    const fila = document.createElement('fieldset');
    fila.innerHTML = `${variantes ? `<label>${compra ? 'Material o producto' : 'Producto y variante'}<select data-campo="${compra ? 'inventario_id' : 'variante_id'}" required><option value="">Seleccionar</option>${variantes.map(v => `<option value="${v.id}">${e([v.nombre, v.color, v.talla].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>${compra ? '' : '<label>Personalización (opcional)<input data-campo="nombre_personalizado"></label>'}` : '<label>Descripción<input data-campo="nombre" required maxlength="500"></label>'}<label>Cantidad<input data-campo="cantidad" type="number" value="1" min="1" max="10000" step="1" required></label>${variantes && !compra ? '' : `<label>${compra ? 'Costo' : 'Precio'} unitario (CRC)<input data-campo="${compra ? 'costo_unitario' : 'precio'}" type="number" min="0" max="999999999" step="0.01" required></label>`}<button type="button" class="secundario" data-quitar>Quitar partida</button>`;
    lista.append(fila);
    activarBusquedas(fila);
    if (compra) fila.querySelector('select').addEventListener('change', evento => {
      const material = variantes.find(v => String(v.id) === evento.target.value);
      fila.querySelector('[data-campo="costo_unitario"]').value = material?.costo ?? '';
      actualizar();
    });
    actualizar();
  }
  function leer() {
    return [...lista.children].map(fila => Object.fromEntries([...fila.querySelectorAll('[data-campo]')].map(campo => [campo.dataset.campo, campo.value])));
  }
  function actualizar() {
    grupo.querySelector('[data-agregar]').disabled = lista.children.length >= 30;
    lista.querySelectorAll('[data-quitar]').forEach(b => { b.disabled = lista.children.length === 1; });
    grupo.querySelector('[data-total]').textContent = variantes && !compra ? `${lista.children.length} partidas` : `Total: ${dinero(leer().reduce((s, p) => s + Number(p.cantidad) * Number(compra ? p.costo_unitario : p.precio), 0))}`;
  }
  grupo.querySelector('[data-agregar]').addEventListener('click', agregar);
  grupo.addEventListener('click', evento => {
    if (evento.target.matches('[data-quitar]') && lista.children.length > 1) { evento.target.closest('fieldset').remove(); actualizar(); }
  });
  grupo.addEventListener('input', actualizar);
  agregar();
  return { grupo, leer };
}

export function activarDocumento(formulario) {
  const { grupo, leer } = montarPartidas(formulario);
  const tipo = formulario.elements.tipo;
  const pedido = formulario.elements.pedido_id;
  const ayuda = document.createElement('p');
  ayuda.setAttribute('role', 'status');
  pedido.closest('label').after(ayuda);
  function actualizar() {
    const obligatorio = ['factura', 'comprobante'].includes(tipo.value);
    pedido.required = obligatorio;
    pedido.options[0].textContent = obligatorio ? 'Seleccioná un pedido' : 'Sin pedido · documento independiente';
    const independiente = !pedido.value && !obligatorio;
    grupo.hidden = !independiente;
    grupo.disabled = !independiente;
    for (const nombre of ['cliente', 'correo', 'direccion']) {
      formulario.elements[nombre].disabled = !independiente;
      formulario.elements[nombre].closest('label').hidden = !independiente;
    }
    ayuda.textContent = obligatorio ? 'Se utilizan los datos y pagos del pedido seleccionado.' : pedido.value ? 'Se utilizan los datos del pedido seleccionado. Quitá la selección para escribir un documento independiente.' : 'No crea pedidos, clientes, movimientos ni reservas de inventario. Recibos y notas de crédito independientes requieren registrar por separado cualquier movimiento de dinero.';
  }
  tipo.addEventListener('change', actualizar);
  pedido.addEventListener('change', actualizar);
  actualizar();
  return datos => ({ ...datos, ...(!pedido.value ? { partidas: leer() } : {}) });
}
