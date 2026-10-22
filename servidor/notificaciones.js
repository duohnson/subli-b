import nodemailer from 'nodemailer';
import { sql } from './base.js';
import { mensajeCobro } from './mensajes.js';
let ejecutando = false;

export async function procesarNotificaciones() {
  if (ejecutando) return;
  ejecutando = true;
  try {
    const vencidos = await sql`SELECT p.id, c.nombre, c.correo, p.total - COALESCE(sum(m.monto), 0) AS saldo FROM pedidos p JOIN clientes c ON c.id = p.cliente_id LEFT JOIN movimientos m ON m.pedido_id = p.id WHERE c.correo IS NOT NULL AND c.correo <> '' AND p.fecha_pago < CURRENT_DATE AND p.estado NOT IN ('cotizacion','cancelado') GROUP BY p.id, c.id HAVING p.total > COALESCE(sum(m.monto), 0)`;
    for (const pedido of vencidos) {
      const mensaje = mensajeCobro(pedido.nombre, pedido.id, `₡${pedido.saldo}`);
      // usar pedido y fecha como clave para no agregar el mismo cobro varias veces en el dia
      await sql`INSERT INTO notificaciones (clave, destinatario, asunto, mensaje) VALUES (${`cobro-${pedido.id}-` } || CURRENT_DATE::text, ${pedido.correo}, 'Recordatorio de pago · Subli’B', ${mensaje}) ON CONFLICT DO NOTHING`;
    }
    if (process.env.CORREO_ADMIN) {
      const alertas = await sql`SELECT 'entrega-' || id AS clave, 'Pedido #' || id || ' por entregar: ' || fecha_prometida AS mensaje FROM pedidos WHERE fecha_prometida <= CURRENT_DATE + 1 AND estado IN ('pendiente','produccion','listo')
      UNION ALL SELECT 'inventario-' || id, 'Inventario bajo: ' || nombre || ' ' || color || ' ' || talla FROM inventario WHERE existencias - reservado <= minimo
      UNION ALL SELECT 'recordatorio-' || id, titulo FROM recordatorios WHERE fecha <= CURRENT_DATE + 1 AND NOT completado
      UNION ALL SELECT 'compra-' || c.id, 'Compra #' || c.id || ' con pago vencido' FROM compras c LEFT JOIN movimientos m ON m.compra_id = c.id WHERE c.vencimiento < CURRENT_DATE GROUP BY c.id HAVING c.cantidad * c.costo_unitario > COALESCE(sum(m.monto), 0)`;
      for (const alerta of alertas) await sql`INSERT INTO notificaciones (clave, destinatario, asunto, mensaje) VALUES (${alerta.clave + '-'} || CURRENT_DATE::text, ${process.env.CORREO_ADMIN}, 'Recordatorio · Subli’B', ${alerta.mensaje}) ON CONFLICT DO NOTHING`;
    }
    // dejar los mensajes en cola si falta SMTP, sin inventar un envio exitoso
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return;
    const transporte = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined, connectionTimeout: 10000, socketTimeout: 20000 });
    const pendientes = await sql`SELECT * FROM notificaciones WHERE enviada IS NULL AND intentos < 5 ORDER BY creado LIMIT 20`;
    for (const pendiente of pendientes) {
      try {
        await transporte.sendMail({ from: process.env.SMTP_FROM, to: pendiente.destinatario, subject: pendiente.asunto, text: pendiente.mensaje });
        await sql`UPDATE notificaciones SET enviada = now(), intentos = intentos + 1, error = NULL WHERE id = ${pendiente.id}`;
      } catch {
        await sql`UPDATE notificaciones SET intentos = intentos + 1, error = 'No se pudo entregar el correo. Revisá SMTP y el destinatario.' WHERE id = ${pendiente.id}`;
      }
    }
    await sql`DELETE FROM sesiones WHERE vence < now()`;
  } finally {
    ejecutando = false;
  }
}
