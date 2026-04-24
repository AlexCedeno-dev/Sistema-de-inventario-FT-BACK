const { crearConexion } = require('../configs/db');

async function buscarEquipoPorServiceTag(serviceTag) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `SELECT equipo_id
       FROM equipos
       WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?))`,
      [serviceTag]
    );

    return rows;
  } finally {
    await db.end();
  }
}

async function buscarEmpleadoPorNombre(nombreCompleto) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `
      SELECT empleado_id
      FROM empleados
      WHERE TRIM(UPPER(nombre_completo)) = TRIM(UPPER(?))
      LIMIT 1
      `,
      [nombreCompleto]
    );

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarEmpleado(empleado) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO empleados (nombre_completo, departamento, planta, status)
      VALUES (?, ?, ?, 'ACTIVO')
      `,
      [
        empleado.nombre_completo,
        empleado.departamento,
        empleado.planta
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function buscarMarcaModelo(marca, modelo) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `
      SELECT marca_id
      FROM marca_dispositivos
      WHERE TRIM(UPPER(marca)) = TRIM(UPPER(?))
        AND TRIM(UPPER(modelo)) = TRIM(UPPER(?))
      LIMIT 1
      `,
      [marca, modelo]
    );

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarMarcaModelo(marca, modelo) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO marca_dispositivos (marca, modelo)
      VALUES (?, ?)
      `,
      [marca, modelo]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function insertarEquipo(data) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO equipos (
        empleado_id,
        marca_id,
        tipo,
        service_tag,
        nombre_equipo,
        specs,
        fecha_compra,
        fecha_asig,
        start_warranty,
        end_warranty
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.empleadoId,
        data.marcaId,
        data.tipo,
        data.service_tag,
        data.nombre_equipo,
        data.specs,
        data.fecha_compra,
        data.fecha_asig,
        data.start_warranty,
        data.end_warranty
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function insertarDatosWindows(equipoId, windows) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO datos_windows (
        equipo_id,
        local_user_windows,
        password_windows,
        usuario_admin,
        password_admin
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        equipoId,
        windows.usuarioWindows,
        windows.passwordWindows,
        windows.usuarioAdmin,
        windows.passwordAdmin
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function actualizarMonitoreoDespuesRegistro(monitoreoId, equipoId) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      UPDATE monitoreo_equipos
      SET registrado_en_inventario = 1,
          pendiente_registro = 0,
          equipo_id_registrado = ?,
          actualizado_en = CURRENT_TIMESTAMP
      WHERE monitoreo_id = ?
      `,
      [equipoId, monitoreoId]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function buscarEquipoPorId(equipoId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `
      SELECT equipo_id, empleado_id, service_tag
      FROM equipos
      WHERE equipo_id = ?
      LIMIT 1
      `,
      [equipoId]
    );

    return rows;
  } finally {
    await db.end();
  }
}

async function liberarMonitoreoPorEquipoId(equipoId) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      UPDATE monitoreo_equipos
      SET registrado_en_inventario = 0,
          pendiente_registro = 1,
          equipo_id_registrado = NULL,
          actualizado_en = CURRENT_TIMESTAMP
      WHERE equipo_id_registrado = ?
      `,
      [equipoId]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function eliminarDatosWindowsPorEquipoId(equipoId) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      DELETE FROM datos_windows
      WHERE equipo_id = ?
      `,
      [equipoId]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function eliminarEquipoPorId(equipoId) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      DELETE FROM equipos
      WHERE equipo_id = ?
      `,
      [equipoId]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function eliminarDocumentosPorEquipoId(equipoId) {
    const db = await crearConexion();

    try {
      const [result] = await db.execute(
        `
        DELETE FROM documentos_equipo
        WHERE equipo_id = ?
        `,
        [equipoId]
      );

      return result;
    } finally {
      await db.end();
    }
}

async function eliminarFirmasPendientesPorEquipoId(equipoId) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      DELETE FROM firmas_pendientes
      WHERE equipo_id = ?
      `,
      [equipoId]
    );

    return result;
  } finally {
    await db.end();
  }
}

module.exports = {
  buscarEquipoPorServiceTag,
  buscarEmpleadoPorNombre,
  insertarEmpleado,
  buscarMarcaModelo,
  insertarMarcaModelo,
  insertarEquipo,
  insertarDatosWindows,
  actualizarMonitoreoDespuesRegistro,
  buscarEquipoPorId,
  liberarMonitoreoPorEquipoId,
  eliminarDatosWindowsPorEquipoId,
  eliminarEquipoPorId,
  eliminarDocumentosPorEquipoId,
  eliminarFirmasPendientesPorEquipoId,
};