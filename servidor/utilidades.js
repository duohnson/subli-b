import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function exigir(condicion, mensaje, estado = 400) {
  if (!condicion) throw Object.assign(Error(mensaje), { estado });
}
export function texto(valor, maximo = 500) {
  return String(valor ?? '').trim().slice(0, maximo);
}
export function numero(valor, minimo = 0) {
  const resultado = Number(valor);
  exigir(valor !== '' && valor !== null && valor !== undefined && Number.isFinite(resultado) && resultado >= minimo && resultado <= 999999999, 'Ingresá un número válido');
  return resultado;
}

export function numeroOpcional(valor, defecto = 0) {
  return numero(valor === null || valor === undefined || String(valor).trim() === '' ? defecto : valor);
}
export const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
export function entero(valor, minimo = 1) {
  const resultado = numero(valor, minimo);
  exigir(Number.isSafeInteger(resultado), 'Ingresá una cantidad entera');
  return resultado;
}
export function correo(valor) {
  const resultado = texto(valor, 254).toLowerCase();
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resultado), 'Ingresá un correo válido');
  return resultado;
}
export function correoOpcional(valor) {
  return texto(valor) ? correo(valor) : null;
}
export function fecha(valor) {
  if (!valor) return null;
  // comparar la fecha convertida para rechazar dias inventados como el 30 de febrero
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor, 'Fecha inválida');
  return valor;
}
export function guardarClave(clave) {
  exigir(typeof clave === 'string' && clave.length >= 12, 'La contraseña debe tener al menos 12 caracteres');
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(clave, sal, 64).toString('hex')}`;
}
export function comprobarClave(clave, guardada) {
  const [sal, resumen] = guardada.split(':');
  const esperado = Buffer.from(resumen, 'hex');
  // comparar sin cortar al primer caracter distinto para no filtrar pistas por el tiempo
  return timingSafeEqual(esperado, scryptSync(String(clave), sal, esperado.length));
}
export function calcularPrecio(datos) {
  const producto = numeroOpcional(datos.producto ?? 0);
  const materiales = numeroOpcional(datos.materiales ?? 0);
  const electricidad = numeroOpcional(datos.electricidad ?? 0);
  const minutos = numeroOpcional(datos.minutos ?? 0);
  const maquinaHora = numeroOpcional(datos.maquina_hora ?? 0);
  const manoHora = numeroOpcional(datos.mano_hora ?? 0);
  const gastosAdicionales = numeroOpcional(datos.gastos_adicionales ?? 0);
  const comisionPorcentaje = numeroOpcional(datos.comision_porcentaje ?? 0);
  const subtotal = producto + materiales + electricidad;
  const costoMaquina = minutos / 60 * maquinaHora;
  const costoManoObra = minutos / 60 * manoHora;
  const redondear = valor => +valor.toFixed(2);
  const costo = redondear(subtotal + costoMaquina + costoManoObra);
  const margen = numeroOpcional(datos.margen ?? 0);
  const descuento = numeroOpcional(datos.descuento ?? 0);
  const ivaPorcentaje = numeroOpcional(datos.iva_porcentaje, 13);
  exigir(margen < 100 && descuento < 100 && comisionPorcentaje < 100 && ivaPorcentaje <= 100, 'Revisá los porcentajes');
  // El margen deseado se conserva sobre el precio efectivamente cobrado, luego del descuento.
  const precio = redondear(costo / (1 - margen / 100));
  const precioLista = redondear(precio / (1 - descuento / 100));
  const cantidad = entero(numeroOpcional(datos.cantidad, 1));
  const total = redondear(precio * cantidad);
  const comision = redondear(precio * comisionPorcentaje / 100);
  const margenBruto = redondear(precio - costo);
  const ganancia = redondear(margenBruto - gastosAdicionales - comision);
  const resultado = {
    costo,
    costo_producto: redondear(producto),
    costo_materiales: redondear(materiales),
    costo_electricidad: redondear(electricidad),
    costo_maquina: redondear(costoMaquina),
    costo_mano_obra: redondear(costoManoObra),
    precio_lista: precioLista,
    precio,
    descuento: +descuento.toFixed(2),
    gastos_adicionales: redondear(gastosAdicionales),
    comision,
    comision_porcentaje: redondear(comisionPorcentaje),
    margen_bruto: margenBruto,
    margen_neto: ganancia,
    porcentaje_margen_bruto: precio > 0 ? redondear(margenBruto / precio * 100) : 0,
    porcentaje_margen_neto: precio > 0 ? redondear(ganancia / precio * 100) : 0,
    total,
    ganancia: redondear(ganancia * cantidad)
  };
  // ahora se suma de nuevo
  if (datos.iva === true) {
    const iva = +(total * ivaPorcentaje / 100).toFixed(2);
    return { ...resultado, iva, totalConIva: +(total + iva).toFixed(2) };
  }
  return resultado;
}
export const transiciones = { cotizacion: ['pendiente', 'cancelado'], pendiente: ['produccion', 'cancelado'], produccion: ['listo'], listo: ['entregado'], entregado: [], cancelado: [] };
