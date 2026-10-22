import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPrecio, guardarClave, comprobarClave, numero, entero, correo, fecha, transiciones } from '../servidor/utilidades.js';

// comprobar que el margen objetivo se conserve tras el descuento y reste costos variables
test('La calculadora separa costos, margen bruto, margen neto y descuento', () => {
  const resultado = calcularPrecio({ producto:1000, materiales:200, electricidad:50, minutos:30, maquina_hora:400, mano_hora:600, gastos_adicionales:100, comision_porcentaje:2, margen:30, descuento:10, cantidad:5 });
  assert.equal(resultado.costo, 1750);
  assert.equal(resultado.precio_lista, 2777.78);
  assert.equal(resultado.precio, 2500);
  assert.equal(resultado.total, 12500);
  assert.equal(resultado.margen_bruto, 750);
  assert.equal(resultado.porcentaje_margen_bruto, 30);
  assert.equal(resultado.margen_neto, 600);
  assert.equal(resultado.porcentaje_margen_neto, 24);
  assert.equal(resultado.ganancia, 3000);
});
// probar datos inválidos para que la calculadora no devuelva precios sin sentido
test('La calculadora rechaza porcentajes y cantidades inválidos', () => {
  for (const datos of [{margen:100},{descuento:100},{comision_porcentaje:100},{iva_porcentaje:101},{cantidad:0},{cantidad:1.5},{producto:-10},{minutos:'incorrecto'}]) assert.throws(() => calcularPrecio(datos));
});
// comprobar q la misma clave produzca huellas distintas pero siga permitiendo el acceso
test('Las claves usan sales distintas y verifican el secreto', () => {
  const primera = guardarClave('una-clave-larga-y-privada');
  const segunda = guardarClave('una-clave-larga-y-privada');
  // confirmar q la sal aleatoria evita guardar huellas iguales
  assert.notEqual(primera,segunda);
  assert.equal(comprobarClave('una-clave-larga-y-privada',primera),true);
  // rechazar una clave distinta aunque tenga el largo suficiente
  assert.equal(comprobarClave('otra-clave-larga',primera),false);
  assert.throws(() => guardarClave('corta'));
});
// cubrir numeros, correo y fechas q pueden llegar mal desde un formulario
test('Se rechazan números no finitos, identificadores fraccionarios y correos inválidos', () => {
  for (const valor of ['',null,undefined,Infinity,NaN,-1]) assert.throws(() => numero(valor));
  assert.throws(() => entero(1.2));
  assert.throws(() => correo('sin-arroba'));
  assert.equal(correo(' CLIENTE@EJEMPLO.COM '),'cliente@ejemplo.com');
  assert.equal(fecha(''),null);
  assert.throws(() => fecha('15/10/2026'));
  // rechazar un dia inexistente aunque el formato de la fecha parezca correcto
  assert.throws(() => fecha('2026-02-30'));
  assert.equal(fecha('2026-10-15'),'2026-10-15');
});
// comprobar las rutas de estado para no reabrir ni producir pedidos terminados
test('No se puede producir dos veces ni reabrir pedidos terminados', () => {
  assert.deepEqual(transiciones.entregado,[]);
  assert.deepEqual(transiciones.cancelado,[]);
  assert.equal(transiciones.produccion.includes('produccion'),false);
  assert.equal(transiciones.cotizacion.includes('produccion'),false);
  assert.equal(transiciones.pendiente.includes('produccion'),true);
});

test('Existencias y mínimos permiten cero pero rechazan fracciones', () => {
  assert.equal(entero('0', 0), 0);
  assert.equal(entero('3', 0), 3);
  for (const valor of [1.3, '0.001', -1, '', null]) assert.throws(() => entero(valor, 0));
  assert.throws(() => entero(0));
});

test('El correo de clientes es opcional y valida los valores presentes', async () => {
  const { correoOpcional } = await import('../servidor/utilidades.js');
  for (const valor of [undefined, null, '', '  ']) assert.equal(correoOpcional(valor), null);
  assert.equal(correoOpcional(' Cliente@Ejemplo.com '), 'cliente@ejemplo.com');
  assert.throws(() => correoOpcional('incorrecto'));
});
