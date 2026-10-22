import { sql } from './base.js';
import { exigir, entero, numero, texto, fecha, correo, correoOpcional, guardarClave } from './utilidades.js';

export async function guardarEmpleado(datos, id = null, conexion = sql) {
  exigir(texto(datos.nombre) && texto(datos.puesto), 'Ingresá el nombre y el puesto');
  return conexion.begin(async consulta => {
    const registro = { nombre: texto(datos.nombre), puesto: texto(datos.puesto), correo: correoOpcional(datos.correo), telefono: texto(datos.telefono), salario: numero(datos.salario), usuario_id: datos.usuario_id ? entero(datos.usuario_id) : null, activo: datos.activo === true };
    if (id) {
      const [anterior] = await consulta`SELECT usuario_id FROM empleados WHERE id = ${id} FOR UPDATE`;
      exigir(anterior, 'Empleado no encontrado', 404);
      // conservar el usuario vinculado para no mover el historial de ventas a otra persona
      exigir(!anterior.usuario_id || anterior.usuario_id === registro.usuario_id, 'El usuario vinculado no se puede reemplazar; conserva el historial de ventas');
    }
    const [empleado] = id ? await consulta`UPDATE empleados SET ${consulta(registro)} WHERE id = ${id} RETURNING *` : await consulta`INSERT INTO empleados ${consulta(registro)} RETURNING *`;
    if (!empleado.activo && empleado.usuario_id) {
      await consulta`UPDATE usuarios SET activo = false WHERE id = ${empleado.usuario_id}`;
      await consulta`DELETE FROM sesiones WHERE usuario_id = ${empleado.usuario_id}`;
    }
    return empleado;
  });
}

export async function crearUsuarioEmpleado(id, datos, conexion = sql) {
  return conexion.begin(async consulta => {
    const [empleado] = await consulta`SELECT * FROM empleados WHERE id = ${id} FOR UPDATE`;
    exigir(empleado?.activo, 'El empleado no existe o está inactivo');
    exigir(!empleado.usuario_id, 'El empleado ya tiene un usuario');
    exigir(['operador', 'administrador'].includes(datos.rol), 'Permisos inválidos');
    const [usuario] = await consulta`INSERT INTO usuarios (nombre, correo, clave, rol) VALUES (${empleado.nombre}, ${correo(datos.correo)}, ${guardarClave(datos.clave)}, ${datos.rol}) RETURNING id`;
    await consulta`UPDATE empleados SET usuario_id = ${usuario.id} WHERE id = ${id}`;
    return { mensaje: 'Usuario creado y vinculado al empleado' };
  });
}

export async function pagarSalario(id, datos, usuario, conexion = sql) {
  exigir(/^\d{4}-(0[1-9]|1[0-2])$/.test(datos.periodo || ''), 'Seleccioná el mes del salario');
  const periodo = fecha(`${datos.periodo}-01`);
  const dia = fecha(datos.fecha);
  exigir(dia, 'Seleccioná la fecha del pago');
  exigir(['efectivo','banco','sinpe','tarjeta'].includes(datos.medio), 'Seleccioná el medio de pago');
  return conexion.begin(async consulta => {
    // bloquear el empleado para q dos clics no registren el mismo salario dos veces
    const [empleado] = await consulta`SELECT * FROM empleados WHERE id = ${id} FOR UPDATE`;
    exigir(empleado?.activo, 'El empleado no existe o está inactivo');
    const [anterior] = await consulta`SELECT id FROM pagos_salarios WHERE empleado_id = ${id} AND periodo = ${periodo}`;
    exigir(!anterior, 'El salario de ese mes ya está registrado', 409);
    const monto = numero(datos.monto, 0.01);
    const [movimiento] = await consulta`INSERT INTO movimientos (tipo, concepto, monto, medio, cuenta, fecha) VALUES ('gasto', ${`Salario ${datos.periodo} - ${empleado.nombre}`}, ${monto}, ${datos.medio}, ${texto(datos.cuenta)}, ${dia}) RETURNING id`;
    await consulta`INSERT INTO pagos_salarios (empleado_id, periodo, movimiento_id, registrado_por) VALUES (${id}, ${periodo}, ${movimiento.id}, ${usuario})`;
    return { mensaje: 'Salario registrado como gasto', movimiento_id: movimiento.id };
  });
}

export async function ventasPorUsuario(desde, hasta, consulta = sql) {
  return consulta`SELECT p.vendedor_id, COALESCE(e.nombre, u.nombre, 'Venta pública / sin vendedor') AS nombre,
    COALESCE(e.puesto, '') AS puesto, count(*)::integer AS pedidos, sum(p.total) AS ventas
    FROM pedidos p LEFT JOIN usuarios u ON u.id = p.vendedor_id LEFT JOIN empleados e ON e.usuario_id = p.vendedor_id
    WHERE p.estado NOT IN ('cotizacion', 'cancelado') AND p.creado::date BETWEEN ${desde} AND ${hasta}
    GROUP BY p.vendedor_id, e.nombre, u.nombre, e.puesto ORDER BY ventas DESC`;
}
