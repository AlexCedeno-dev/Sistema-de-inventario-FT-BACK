const { crearConexion } = require('../configs/db');

const TIPOS_DESTINO_VALIDOS = ['ESTACION_OLS', 'EMPLEADO'];

async function obtenerComponentesDisponiblesPorTipo(tipo) {
  const db = await crearConexion();
  try {
    if (tipo) {
      const [rows] = await db.execute(
        `SELECT * FROM componentes_manufactura
         WHERE estado = 'DISPONIBLE' AND tipo = ?
         ORDER BY fecha_alta DESC`,
        [tipo]
      );
      return rows;
    }
    const [rows] = await db.execute(
      `SELECT * FROM componentes_manufactura
       WHERE estado = 'DISPONIBLE'
       ORDER BY fecha_alta DESC`
    );
    return rows;
  } finally {
    await db.end();
  }
}

async function crearAsignacion(datos, usuarioId) {
  const { componente_id, tipo_destino, estacion_id, empleado_id } = datos;

  if (!TIPOS_DESTINO_VALIDOS.includes(tipo_destino)) {
    const err = new Error(`tipo_destino debe ser uno de: ${TIPOS_DESTINO_VALIDOS.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }
  if (tipo_destino === 'ESTACION_OLS' && !estacion_id) {
    const err = new Error('estacion_id es obligatorio cuando tipo_destino es ESTACION_OLS.');
    err.statusCode = 400;
    throw err;
  }
  if (tipo_destino === 'EMPLEADO' && !empleado_id) {
    const err = new Error('empleado_id es obligatorio cuando tipo_destino es EMPLEADO.');
    err.statusCode = 400;
    throw err;
  }

  const destId = tipo_destino === 'ESTACION_OLS' ? estacion_id : empleado_id;

  const db = await crearConexion();
  try {
    await db.beginTransaction();

    const [compRows] = await db.execute(
      `SELECT * FROM componentes_manufactura WHERE componente_id = ? LIMIT 1 FOR UPDATE`,
      [componente_id]
    );
    const componente = compRows[0] ?? null;
    if (!componente) {
      const err = new Error(`Componente ${componente_id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }
    if (componente.estado !== 'DISPONIBLE') {
      const err = new Error(
        `El componente ${componente.activo_fijo} no está disponible (estado actual: ${componente.estado}).`
      );
      err.statusCode = 409;
      throw err;
    }

    const [asignResult] = await db.execute(
      `INSERT INTO asignaciones_componentes
         (componente_id, tipo_destino, estacion_id, empleado_id, asignado_por, estado)
       VALUES (?, ?, ?, ?, ?, 'ACTIVA')`,
      [
        componente_id,
        tipo_destino,
        tipo_destino === 'ESTACION_OLS' ? estacion_id : null,
        tipo_destino === 'EMPLEADO' ? empleado_id : null,
        usuarioId ?? null,
      ]
    );
    const asignacionId = asignResult.insertId;

    await db.execute(
      `UPDATE componentes_manufactura SET estado = 'ASIGNADO' WHERE componente_id = ?`,
      [componente_id]
    );

    await db.execute(
      `INSERT INTO auditoria_componentes
         (componente_id, activo_fijo, accion, realizado_por_id, descripcion)
       VALUES (?, ?, 'ASIGNACION', ?, ?)`,
      [
        componente_id,
        componente.activo_fijo,
        usuarioId ?? null,
        `Asignación de ${componente.tipo} ${componente.activo_fijo} a ${tipo_destino} ${destId}`,
      ]
    );

    await db.commit();

    const [rows] = await db.execute(
      `SELECT
         a.asignacion_id, a.tipo_destino, a.estacion_id, a.empleado_id,
         a.fecha_asignacion, a.estado,
         c.componente_id, c.tipo, c.marca, c.modelo,
         c.activo_fijo, c.numero_serie
       FROM asignaciones_componentes a
       INNER JOIN componentes_manufactura c ON c.componente_id = a.componente_id
       WHERE a.asignacion_id = ? LIMIT 1`,
      [asignacionId]
    );
    return rows[0];
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function listarAsignacionesPorEstacion(estacionId) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(
      `SELECT
         a.asignacion_id, a.componente_id, a.fecha_asignacion,
         c.tipo, c.marca, c.modelo, c.activo_fijo, c.numero_serie
       FROM asignaciones_componentes a
       INNER JOIN componentes_manufactura c ON c.componente_id = a.componente_id
       WHERE a.estacion_id = ? AND a.estado = 'ACTIVA'
       ORDER BY a.fecha_asignacion DESC`,
      [estacionId]
    );
    return rows;
  } finally {
    await db.end();
  }
}

async function listarAsignacionesPorEmpleado(empleadoId) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(
      `SELECT
         a.asignacion_id, a.componente_id, a.fecha_asignacion,
         c.tipo, c.marca, c.modelo, c.activo_fijo, c.numero_serie
       FROM asignaciones_componentes a
       INNER JOIN componentes_manufactura c ON c.componente_id = a.componente_id
       WHERE a.empleado_id = ? AND a.estado = 'ACTIVA'
       ORDER BY a.fecha_asignacion DESC`,
      [empleadoId]
    );
    return rows;
  } finally {
    await db.end();
  }
}

async function liberarAsignacion(asignacionId, usuarioId, usuarioNombre, usuarioRol) {
  const db = await crearConexion();
  try {
    await db.beginTransaction();

    const [asignRows] = await db.execute(
      `SELECT * FROM asignaciones_componentes WHERE asignacion_id = ? AND estado = 'ACTIVA' LIMIT 1`,
      [asignacionId]
    );
    const asignacion = asignRows[0] ?? null;
    if (!asignacion) {
      const err = new Error(`Asignación ${asignacionId} no encontrada o ya liberada.`);
      err.statusCode = 404;
      throw err;
    }

    await db.execute(
      `UPDATE asignaciones_componentes
       SET estado = 'LIBERADA', fecha_liberacion = NOW(), liberado_por = ?
       WHERE asignacion_id = ?`,
      [usuarioId ?? null, asignacionId]
    );

    await db.execute(
      `UPDATE componentes_manufactura SET estado = 'DISPONIBLE' WHERE componente_id = ?`,
      [asignacion.componente_id]
    );

    const [compRows] = await db.execute(
      `SELECT activo_fijo, tipo FROM componentes_manufactura WHERE componente_id = ? LIMIT 1`,
      [asignacion.componente_id]
    );
    const componente = compRows[0];

    await db.execute(
      `INSERT INTO auditoria_componentes
         (componente_id, activo_fijo, accion,
          realizado_por_id, realizado_por_nombre, realizado_por_rol, descripcion)
       VALUES (?, ?, 'LIBERACION', ?, ?, ?, ?)`,
      [
        asignacion.componente_id,
        componente?.activo_fijo ?? null,
        usuarioId ?? null,
        usuarioNombre ?? 'Desconocido',
        usuarioRol ?? 'Desconocido',
        `Liberación de ${componente?.tipo ?? 'componente'} ${componente?.activo_fijo ?? asignacion.componente_id} de asignación ${asignacionId}`,
      ]
    );

    await db.commit();

    return { ...asignacion, estado: 'LIBERADA' };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

module.exports = {
  obtenerComponentesDisponiblesPorTipo,
  crearAsignacion,
  listarAsignacionesPorEstacion,
  listarAsignacionesPorEmpleado,
  liberarAsignacion,
};
