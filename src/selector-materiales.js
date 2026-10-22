import { escapar } from './comun.js?v=20261017-panel-2';

export function selectorMateriales(opciones, ids = []) {
  const seleccionados = new Set(ids.map(String));
  return `<fieldset class="selector-materiales"><legend>Materiales que vende</legend><label>Buscar por nombre, color, talla o código<input type="search" data-buscar-material placeholder="Buscar materiales…"></label><div class="acciones-materiales"><button type="button" class="secundario" data-seleccionar-materiales="true">Seleccionar resultados</button><button type="button" class="secundario" data-seleccionar-materiales="false">Quitar resultados</button></div><p data-resumen-materiales role="status"></p><select name="inventario_ids" multiple hidden>${opciones.map(opcion => `<option value="${opcion.id}" ${seleccionados.has(String(opcion.id)) ? 'selected' : ''}>${escapar(opcion.nombre)}</option>`).join('')}</select><div class="lista-materiales">${opciones.map(opcion => `<label class="casilla" data-material><input type="checkbox" data-material-id="${opcion.id}" ${seleccionados.has(String(opcion.id)) ? 'checked' : ''}><span>#${opcion.id} · ${escapar([opcion.nombre, opcion.color, opcion.talla].filter(Boolean).join(' · '))}</span></label>`).join('')}</div><p data-materiales-vacios hidden>No hay materiales que coincidan.</p><small>La selección se conserva al cambiar la búsqueda. Se guardan todos los materiales juntos.</small></fieldset>`;
}

export function activarSelectorMateriales(formulario) {
  const grupo = formulario.querySelector('.selector-materiales');
  if (!grupo) return;
  const filas = [...grupo.querySelectorAll('[data-material]')];
  const opciones = new Map([...grupo.querySelector('select').options].map(opcion => [opcion.value, opcion]));
  const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  function actualizar() {
    const visibles = filas.filter(fila => !fila.hidden);
    const seleccionados = filas.filter(fila => fila.querySelector('input').checked).length;
    grupo.querySelector('[data-resumen-materiales]').textContent = `${seleccionados} seleccionados de ${filas.length} · ${visibles.length} resultados`;
    grupo.querySelector('[data-materiales-vacios]').hidden = visibles.length > 0;
    grupo.querySelectorAll('[data-seleccionar-materiales]').forEach(boton => { boton.disabled = !visibles.length; });
  }
  function seleccionar(casilla, valor) {
    casilla.checked = valor;
    opciones.get(casilla.dataset.materialId).selected = valor;
  }
  grupo.querySelector('[data-buscar-material]').addEventListener('input', evento => {
    const palabras = normalizar(evento.target.value).split(/\s+/).filter(Boolean);
    filas.forEach(fila => { fila.hidden = !palabras.every(palabra => normalizar(fila.textContent).includes(palabra)); });
    actualizar();
  });
  grupo.addEventListener('change', evento => {
    if (!evento.target.matches('[data-material-id]')) return;
    seleccionar(evento.target, evento.target.checked);
    actualizar();
  });
  grupo.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-seleccionar-materiales]');
    if (!boton) return;
    filas.filter(fila => !fila.hidden).forEach(fila => seleccionar(fila.querySelector('input'), boton.dataset.seleccionarMateriales === 'true'));
    actualizar();
  });
  actualizar();
}
