// editar estos textos aca para cambiar los correos nuevos sin tocar postgres
const listo = "Hola {cliente}, tu pedido #{pedido} está listo. ¡Gracias por elegir Subli’B!";
const cobro = "Hola {cliente}, tu pedido #{pedido} tiene un saldo pendiente de {saldo}. Contactanos para coordinar el pago.";

export function mensajeListo(cliente, pedido) {
  return listo.replaceAll('{cliente}', cliente).replaceAll('{pedido}', String(pedido));
}

export function mensajeCobro(cliente, pedido, saldo) {
  return cobro.replaceAll('{cliente}', cliente).replaceAll('{pedido}', String(pedido)).replaceAll('{saldo}', saldo);
}
