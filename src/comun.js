export const dinero = valor => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(valor || 0));
export const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caracter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caracter]));
export const fechaCorta = valor => {
  if (!valor) return 'Sin fecha';
  const texto = String(valor);
  if (/T\d{2}:\d{2}:\d{2}/.test(texto) && !/T00:00:00(?:\.000)?Z$/.test(texto)) {
    return new Date(texto).toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  }
  return texto.slice(0, 10);
};
export async function pedir(ruta, datos, metodo = 'POST') {
  // dejar q el navegador ponga el separador de archivos cuando se usa FormData
  const opciones = datos instanceof FormData ? { method: metodo, body: datos } : datos === undefined ? {} : { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) };
  const respuesta = await fetch(ruta, opciones);
  const tipo = respuesta.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) {
    const contenido = await respuesta.text();
    if (contenido.trimStart().startsWith('<')) {
      throw Error(`El servidor devolvió una página web en vez de una respuesta de la API (HTTP ${respuesta.status}). Revisá que la aplicación esté conectada al servidor actualizado.`);
    }
    throw Error(contenido || `El servidor respondió con HTTP ${respuesta.status}`);
  }
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw Error(resultado.error || 'No se pudo completar la solicitud');
  return resultado;
}
export function datosFormulario(formulario) {
  const datos = Object.fromEntries(new FormData(formulario));
  formulario.querySelectorAll('select[multiple]').forEach(campo => { datos[campo.name] = [...campo.selectedOptions].map(opcion => campo.name === 'imagenes' ? opcion.value : Number(opcion.value)); });
  // incluir tambien las casillas desmarcadas porque FormData normalmente las omite
  formulario.querySelectorAll('[type=checkbox][name]').forEach(campo => { datos[campo.name] = campo.checked; });
  return datos;
}
