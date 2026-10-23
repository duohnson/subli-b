import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const logo = fileURLToPath(new URL('../src/img/LOGO.png', import.meta.url));
const titulos = { factura: 'Factura', cotizacion: 'Cotización', proforma: 'Proforma', recibo: 'Recibo', comprobante: 'Comprobante de pago', nota_credito: 'Nota de crédito' };
const moneda = valor => 'CRC ' + Number(valor || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = valor => valor ? new Date(valor).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }) : 'Sin fecha';
const ancho = 507;
const limite = 732;

function iniciar(salida, titulo, referencia, emision) {
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 44, bottom: 42, left: 44, right: 44 }, bufferPages: true, info: { Title: `${titulo} - ${referencia}`, Author: 'Subli’B', Creator: 'Subli’B' } });
  pdf.registerFont('Regular', fileURLToPath(new URL('./fuentes/DejaVuSans.ttf', import.meta.url)));
  pdf.registerFont('Negrita', fileURLToPath(new URL('./fuentes/DejaVuSans-Bold.ttf', import.meta.url)));
  pdf.pipe(salida);
  function cabecera() {
    pdf.rect(0, 0, pdf.page.width, 5).fill('#c62835');
    pdf.image(logo, 44, 27, { width: 66 });
    pdf.font('Negrita').fontSize(21).fillColor('#172334').text('Subli’B', 124, 33);
    pdf.font('Regular').fontSize(9).fillColor('#596579').text('Sublimación y productos personalizados', 124, 60);
    pdf.text('Costa Rica  |  +506 6231 7181', 124, 75);
    pdf.moveTo(44, 108).lineTo(551, 108).lineWidth(1).strokeColor('#e2e6ec').stroke();
    pdf.font('Negrita').fontSize(22).fillColor('#172334').text(titulo, 44, 128, { width: 355 });
    pdf.fontSize(11).text(referencia, 402, 132, { width: 149, align: 'right' });
    pdf.font('Regular').fontSize(9).fillColor('#596579').text(`Emisión: ${fecha(emision)}`, 402, 151, { width: 149, align: 'right' });
    pdf.rect(44, 163, 42, 4).fill('#f2c900');
    pdf.y = 188;
  }
  cabecera();
  pdf.on('pageAdded', cabecera);
  return pdf;
}

function escribir(pdf, texto, x, y, anchoTexto, opciones = {}) {
  pdf.font(opciones.negrita ? 'Negrita' : 'Regular').fontSize(opciones.tamano || 10).fillColor(opciones.color || '#172334');
  pdf.text(String(texto ?? ''), x, y, { width: anchoTexto, lineGap: 3, align: opciones.alinear || 'left' });
  return pdf.y;
}

function tabla(pdf, encabezados, anchos, filas) {
  let y = pdf.y;
  function encabezado() {
    pdf.roundedRect(44, y, ancho, 29, 4).fill('#172334');
    let x = 44;
    encabezados.forEach((titulo, i) => { escribir(pdf, titulo, x + 9, y + 9, anchos[i] - 18, { tamano: 8, negrita: true, color: '#ffffff', alinear: i ? 'right' : 'left' }); x += anchos[i]; });
    y += 29;
  }
  if (y + 75 > limite) { pdf.addPage(); y = pdf.y; }
  encabezado();
  filas.forEach((fila, indice) => {
    // partir descripciones extensas para q una sola partida no desborde la pagina
    const partes = fila.map(valor => String(valor ?? '').match(/[\s\S]{1,420}(?:\s|$)|[\s\S]{1,420}/g) || ['']);
    for (let tramo = 0; tramo < Math.max(...partes.map(p => p.length)); tramo++) {
      const textos = partes.map(p => p[tramo] || '');
      pdf.font('Regular').fontSize(9);
      const alto = Math.max(34, ...textos.map((texto, i) => pdf.heightOfString(texto, { width: anchos[i] - 18, lineGap: 3 }) + 18));
      if (y + alto > limite) { pdf.addPage(); y = pdf.y; encabezado(); }
      if (indice % 2 === 0) pdf.rect(44, y, ancho, alto).fill('#f3f5f8');
      let x = 44;
      textos.forEach((texto, i) => { escribir(pdf, texto, x + 9, y + 9, anchos[i] - 18, { tamano: 9, alinear: i ? 'right' : 'left' }); x += anchos[i]; });
      y += alto;
      pdf.moveTo(44, y).lineTo(551, y).lineWidth(0.5).strokeColor('#e2e6ec').stroke();
    }
  });
  pdf.y = y + 22;
}

function totales(pdf, filas) {
  const alto = filas.length * 29 + 22;
  if (pdf.y + alto > limite) pdf.addPage();
  const y = pdf.y;
  pdf.roundedRect(277, y, 274, alto, 6).fill('#f3f5f8');
  filas.forEach(([etiqueta, valor], i) => {
    const ultimo = i === filas.length - 1;
    if (ultimo) pdf.roundedRect(277, y + 11 + i * 29, 274, 29, 4).fill('#f5d629');
    escribir(pdf, etiqueta, 289, y + 19 + i * 29, 115, { tamano: 9, negrita: ultimo });
    escribir(pdf, moneda(valor), 404, y + 19 + i * 29, 135, { tamano: 10, negrita: ultimo, alinear: 'right' });
  });
  pdf.y = y + alto + 22;
}

function terminar(pdf, nota) {
  if (pdf.y + 50 > limite) pdf.addPage();
  escribir(pdf, nota, 44, pdf.y, ancho, { tamano: 9, color: '#596579' });
  const paginas = pdf.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    pdf.switchToPage(i);
    pdf.moveTo(44, 772).lineTo(551, 772).strokeColor('#e2e6ec').stroke();
    escribir(pdf, 'Subli’B  |  @subli__b', 44, 785, 300, { tamano: 8, color: '#596579' });
    escribir(pdf, `Página ${i + 1} de ${paginas.count}`, 401, 785, 150, { tamano: 8, color: '#596579', alinear: 'right' });
  }
  pdf.end();
}

export function generarDocumento(salida, fila) {
  const pdf = iniciar(salida, titulos[fila.tipo] || 'Documento', `N.º ${String(fila.id).padStart(6, '0')}`, fila.creado);
  const detalle = fila.detalle;
  let y = escribir(pdf, fila.pedido_id ? `CLIENTE  /  PEDIDO #${fila.pedido_id}` : 'CLIENTE', 44, pdf.y, ancho, { tamano: 8, negrita: true, color: '#596579' });
  y = escribir(pdf, detalle.cliente, 44, y + 8, ancho, { tamano: 12, negrita: true });
  y = escribir(pdf, [detalle.correo, detalle.direccion].filter(Boolean).join('\n'), 44, y + 5, ancho, { tamano: 9, color: '#596579' });
  pdf.y = y + 24;
  tabla(pdf, ['PRODUCTO / DESCRIPCIÓN', 'CANT.', 'PRECIO UNIT.', 'IMPORTE'], [245, 45, 107, 110], detalle.partidas.map(p => [[p.nombre, [p.color, p.talla].filter(Boolean).join(' / '), p.nombre_personalizado ? `Personalización: ${p.nombre_personalizado}` : ''].filter(Boolean).join('\n'), p.cantidad, moneda(p.precio), moneda(p.cantidad * p.precio)]));
  const totalPedido = detalle.partidas.reduce((total, p) => total + Number(p.cantidad) * Number(p.precio), 0);
  if (fila.tipo === 'recibo' && !fila.pedido_id) {
    totales(pdf, [['Importe recibido', fila.total]]);
  } else if (['recibo', 'comprobante'].includes(fila.tipo)) {
    totales(pdf, [['Total del pedido', totalPedido], ['Saldo del pedido', totalPedido - Number(detalle.pagado)], ['Pagos registrados', fila.total]]);
  } else if (fila.tipo === 'nota_credito') {
    totales(pdf, [['Importe de la nota', fila.total]]);
  } else {
    totales(pdf, [['Total del documento', fila.total], ['Pagos registrados', detalle.pagado], ['Saldo pendiente', Number(fila.total) - Number(detalle.pagado)]]);
  }
  const nota = fila.tipo === 'recibo' && !fila.pedido_id ? 'Recibo independiente. No registra un movimiento de caja; registrá el ingreso en Finanzas si corresponde.' : fila.tipo === 'nota_credito' ? 'Esta nota no registra por sí sola una devolución de dinero ni una reposición de inventario.' : ['recibo', 'comprobante'].includes(fila.tipo) ? 'Este documento refleja los pagos acumulados registrados al momento de su emisión.' : 'Importes expresados en colones costarricenses (CRC).';
  terminar(pdf, `${nota}\nDocumento interno. No es un comprobante electrónico tributario.`);
}

export function generarReporte(salida, filas, desde, hasta) {
  const pdf = iniciar(salida, 'Reporte financiero', 'MOVIMIENTOS', new Date());
  escribir(pdf, `Período: ${desde} al ${hasta}`, 44, pdf.y, ancho, { tamano: 11 });
  pdf.y += 18;
  tabla(pdf, ['CONCEPTO / FECHA', 'TIPO / MEDIO', 'MONTO', 'COMISIÓN'], [223, 90, 107, 87], filas.map(f => [[f.concepto, f.fecha, f.cuenta].filter(Boolean).join('\n'), `${f.tipo}\n${f.medio}`, moneda(f.monto), moneda(f.comision)]));
  const ingresos = filas.filter(f => f.tipo === 'ingreso').reduce((n, f) => n + Number(f.monto), 0);
  const gastos = filas.filter(f => f.tipo === 'gasto').reduce((n, f) => n + Number(f.monto), 0);
  const comisiones = filas.reduce((n, f) => n + Number(f.comision), 0);
  totales(pdf, [['Ingresos', ingresos], ['Gastos', gastos], ['Comisiones', comisiones], ['Flujo neto', ingresos - gastos - comisiones]]);
  terminar(pdf, `${filas.length} movimientos registrados. El flujo neto corresponde a ingresos menos gastos y comisiones. Los impuestos incluidos no se descuentan nuevamente.`);
}
