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
        bios_password,
        specs,
        fecha_compra,
        fecha_asig,
        start_warranty,
        end_warranty
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.empleadoId,
        data.marcaId,
        data.tipo,
        data.service_tag,
        data.nombre_equipo,
        data.bios_password,
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

async function crearAccesoEquipo(empleadoId, licenciaOffice = null) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      
      `
      INSERT INTO licencias_accesos (
        empleado_id,
        licencia_office
      )
      VALUES (?, ?)
      `,
      [
        empleadoId,
        licenciaOffice || null
      ]
    );

    return result.insertId;
  } finally {
    await db.end();
  }
}

async function insertarLicenciaEnrollado(empleadoId, data) {
const accesoId = await obtenerOCrearAccesoEmpleado(empleadoId, data.licencia_office);
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO licencia_enrrolado (
        acceso_id,
        correo_enrrolado,
        password_enrrolado
      )
      VALUES (?, ?, ?)
      `,
      [
        accesoId,
        data.correo_enrrolado || null,
        data.password_enrrolado || null
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function insertarLicenciaNas(empleadoId, data) {
  const accesoId = await obtenerOCrearAccesoEmpleado(empleadoId);
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO licencia_nas (
        acceso_id,
        usuario_nas,
        password_nas
      )
      VALUES (?, ?, ?)
      `,
      [
        accesoId,
        data.usuario_nas || null,
        data.password_nas || null
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function insertarLicenciaVpn(empleadoId, data) {
  const accesoId = await obtenerOCrearAccesoEmpleado(empleadoId);
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO licencia_vpn (
        acceso_id,
        usuario_vpn,
        password_vpn
      )
      VALUES (?, ?, ?)
      `,
      [
        accesoId,
        data.usuario_vpn || null,
        data.password_vpn || null
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function insertarLicenciaOsticket(empleadoId, data) {
  const accesoId = await obtenerOCrearAccesoEmpleado(empleadoId);
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO licencia_osticket (
        acceso_id,
        usuario_osticket,
        password_osticket
      )
      VALUES (?, ?, ?)
      `,
      [
        accesoId,
        data.usuario_osticket || null,
        data.password_osticket || null
      ]
    );

    return result;
  } finally {
    await db.end();
  }
}

async function actualizarEquipoCompleto(equipoId, empleadoId, body) {
  const db = await crearConexion();

  try {

    await db.execute(`
      UPDATE empleados
      SET nombre_completo = ?,
          departamento = ?,
          planta = ?
      WHERE empleado_id = ?
    `,[
      body.empleado.nombre_completo,
      body.empleado.departamento,
      body.empleado.planta,
      empleadoId
    ]);

    await db.execute(`
      UPDATE equipos
      SET tipo = ?,
          service_tag = ?,
          nombre_equipo = ?,
          bios_password = ?,
          specs = ?,
          fecha_compra = ?,
          fecha_asig = ?,
          start_warranty = ?,
          end_warranty = ?
      WHERE equipo_id = ?
    `,[
      body.equipo.tipo,
      body.equipo.service_tag,
      body.equipo.nombre_equipo,
      body.equipo.bios_password,
      body.equipo.specs,
      body.equipo.fecha_compra,
      body.equipo.fecha_asig,
      body.equipo.start_warranty,
      body.equipo.end_warranty,
      equipoId
    ]);

    await db.execute(`
      UPDATE datos_windows
      SET local_user_windows=?,
          password_windows=?,
          usuario_admin=?,
          password_admin=?
      WHERE equipo_id=?
    `,[
      body.windows.usuarioWindows,
      body.windows.passwordWindows,
      body.windows.usuarioAdmin,
      body.windows.passwordAdmin,
      equipoId
    ]);

    const [accRows] = await db.execute(`
      SELECT acceso_id
      FROM licencias_accesos
      WHERE empleado_id=?
      LIMIT 1
    `,[empleadoId]);

    if(accRows.length){
      const accesoId = accRows[0].acceso_id;

      await db.execute(`
       UPDATE licencias_accesos
       SET licencia_office=?
       WHERE acceso_id=?
      `,[
       body.equipo.licencia_office,
       accesoId
      ]);

      await db.execute(`
       UPDATE licencia_enrrolado
       SET correo_enrrolado=?,
           password_enrrolado=?
       WHERE acceso_id=?
      `,[
       body.windows.correoEnrollado,
       body.windows.passwordEnrollado,
       accesoId
      ]);

      await db.execute(`
       UPDATE licencia_nas
       SET usuario_nas=?,
           password_nas=?
       WHERE acceso_id=?
      `,[
       body.accesos.usuarioNAS,
       body.accesos.passwordNAS,
       accesoId
      ]);

      await db.execute(`
       UPDATE licencia_vpn
       SET usuario_vpn=?,
           password_vpn=?
       WHERE acceso_id=?
      `,[
       body.accesos.usuarioVPN,
       body.accesos.passwordVPN,
       accesoId
      ]);

      await db.execute(`
       UPDATE licencia_osticket
       SET usuario_osticket=?,
           password_osticket=?
       WHERE acceso_id=?
      `,[
       body.accesos.usuarioOsticket,
       body.accesos.passwordOsticket,
       accesoId
      ]);
    }

    return {status:'ok'};

  } finally {
    await db.end();
  }
}

async function obtenerOCrearAccesoEmpleado(empleadoId, licenciaOffice = null) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `
      SELECT acceso_id
      FROM licencias_accesos
      WHERE empleado_id = ?
      ORDER BY acceso_id DESC
      LIMIT 1
      `,
      [empleadoId]
    );

    if (rows.length > 0) {
      const accesoId = rows[0].acceso_id;

      if (licenciaOffice) {
        await db.execute(
          `
          UPDATE licencias_accesos
          SET licencia_office = ?
          WHERE acceso_id = ?
          `,
          [licenciaOffice, accesoId]
        );
      }

      return accesoId;
    }

    const [result] = await db.execute(
      `
      INSERT INTO licencias_accesos (
        empleado_id,
        licencia_office
      )
      VALUES (?, ?)
      `,
      [empleadoId, licenciaOffice || null]
    );

    return result.insertId;
  } finally {
    await db.end();
  }
}

async function obtenerDetalleEquipo(equipoId) {
  const db = await crearConexion();

    try {
      const [equipoRows] = await db.execute(`
        SELECT
          e.equipo_id,
          e.empleado_id,
          e.tipo,
          e.service_tag,
          e.nombre_equipo,
          e.bios_password,
          e.specs,
          DATE_FORMAT(e.fecha_compra,'%Y-%m-%d') AS fecha_compra,
          DATE_FORMAT(e.fecha_asig,'%Y-%m-%d') AS fecha_asig,
          DATE_FORMAT(e.start_warranty,'%Y-%m-%d') AS start_warranty,
          DATE_FORMAT(e.end_warranty,'%Y-%m-%d') AS end_warranty,

          emp.nombre_completo,
          emp.departamento,
          emp.planta,

          md.marca,
          md.modelo
        FROM equipos e
        LEFT JOIN empleados emp
          ON emp.empleado_id = e.empleado_id
        LEFT JOIN marca_dispositivos md
          ON md.marca_id = e.marca_id
        WHERE e.equipo_id = ?
        LIMIT 1
      `, [equipoId]);

      if (!equipoRows.length) return [];

      const equipo = equipoRows[0];
      const empleadoId = equipo.empleado_id;

      const [windowsRows] = await db.execute(`
        SELECT
          local_user_windows,
          password_windows,
          usuario_admin,
          password_admin
        FROM datos_windows
        WHERE equipo_id = ?
        LIMIT 1
      `, [equipoId]);

      const [accesoRows] = await db.execute(`
        SELECT acceso_id, licencia_office
        FROM licencias_accesos
        WHERE empleado_id = ?
        ORDER BY acceso_id DESC
        LIMIT 1
      `, [empleadoId]);

      const acceso = accesoRows[0] || null;
      const accesoId = acceso?.acceso_id || null;

      let enrrolado = {};
      let nas = {};
      let vpn = {};
      let osticket = {};

      if (accesoId) {
        const [enrroladoRows] = await db.execute(`
          SELECT correo_enrrolado, password_enrrolado
          FROM licencia_enrrolado
          WHERE acceso_id = ?
          LIMIT 1
        `, [accesoId]);

        const [nasRows] = await db.execute(`
          SELECT usuario_nas, password_nas
          FROM licencia_nas
          WHERE acceso_id = ?
          LIMIT 1
        `, [accesoId]);

        const [vpnRows] = await db.execute(`
          SELECT usuario_vpn, password_vpn
          FROM licencia_vpn
          WHERE acceso_id = ?
          LIMIT 1
        `, [accesoId]);

        const [osticketRows] = await db.execute(`
          SELECT usuario_osticket, password_osticket
          FROM licencia_osticket
          WHERE acceso_id = ?
          LIMIT 1
        `, [accesoId]);

        enrrolado = enrroladoRows[0] || {};
        nas = nasRows[0] || {};
        vpn = vpnRows[0] || {};
        osticket = osticketRows[0] || {};
      }

      return [{
        ...equipo,
        ...(windowsRows[0] || {}),
        licencia_office: acceso?.licencia_office || null,
        ...enrrolado,
        ...nas,
        ...vpn,
        ...osticket
      }];
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

  insertarLicenciaEnrollado,
  insertarLicenciaNas,
  insertarLicenciaVpn,
  insertarLicenciaOsticket,

  actualizarMonitoreoDespuesRegistro,
  buscarEquipoPorId,
  liberarMonitoreoPorEquipoId,
  eliminarDatosWindowsPorEquipoId,
  eliminarEquipoPorId,
  eliminarDocumentosPorEquipoId,
  eliminarFirmasPendientesPorEquipoId,
  actualizarEquipoCompleto,

  obtenerDetalleEquipo,
};