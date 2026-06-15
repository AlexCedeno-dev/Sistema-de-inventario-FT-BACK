const { crearConexion } = require('../configs/db');
const crypto = require('crypto');

async function buscarEquipoPorServiceTag(serviceTag) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `
      SELECT equipo_id, empleado_id, service_tag, qr_token, estado_registro
      FROM equipos
      WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?))
      LIMIT 1
      `,
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
      INSERT INTO empleados (nombre_completo, nomina, departamento, planta, tipo_empleado, nombre_gerente, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVO')
      `,
      [
        empleado.nombre_completo,
        empleado.nomina ?? null,
        empleado.departamento,
        empleado.planta,
        empleado.tipo_empleado ?? null,
        empleado.nombre_gerente ?? null
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
    const serviceTag = data.service_tag?.trim();

    const [existente] = await db.execute(
      `
      SELECT equipo_id, qr_token
      FROM equipos
      WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?))
      LIMIT 1
      `,
      [serviceTag]
    );

    if (existente.length > 0) {
      const equipoIdExistente = existente[0].equipo_id;
      const qrTokenFinal = existente[0].qr_token || crypto.randomUUID();

      await db.execute(
        `
        UPDATE equipos
        SET empleado_id = ?,
            marca_id = ?,
            tipo = ?,
            service_tag = ?,
            nombre_equipo = ?,
            bios_password = ?,
            specs = ?,
            fecha_compra = ?,
            fecha_asig = ?,
            start_warranty = ?,
            end_warranty = ?,
            qr_token = ?,
            permiso_salida = ?,
            estado_registro = 'ACTIVO'
        WHERE equipo_id = ?
        `,
        [
          data.empleadoId,
          data.marcaId,
          data.tipo,
          serviceTag,
          data.nombre_equipo,
          data.bios_password,
          data.specs,
          data.fecha_compra,
          data.fecha_asig,
          data.start_warranty,
          data.end_warranty,
          qrTokenFinal,
          data.permiso_salida ?? 0,
          equipoIdExistente
        ]
      );

      return {
        insertId: equipoIdExistente,
        affectedRows: 1,
        reutilizado: true,
        qr_token: qrTokenFinal
      };
    }

    const qrTokenNuevo = crypto.randomUUID();

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
        end_warranty,
        qr_token,
        permiso_salida,
        estado_registro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')
      `,
      [
        data.empleadoId,
        data.marcaId,
        data.tipo,
        serviceTag,
        data.nombre_equipo,
        data.bios_password,
        data.specs,
        data.fecha_compra,
        data.fecha_asig,
        data.start_warranty,
        data.end_warranty,
        qrTokenNuevo,
        data.permiso_salida ?? 0
      ]
    );

    return {
      ...result,
      reutilizado: false,
      qr_token: qrTokenNuevo
    };
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
    const [equipoRows] = await db.execute(
      `SELECT equipo_id, service_tag
       FROM equipos
       WHERE equipo_id = ?
       LIMIT 1`,
      [equipoId]
    );

    const serviceTag = equipoRows[0]?.service_tag || null;

    await db.execute(
      `UPDATE monitoreo_equipos
       SET registrado_en_inventario = 0,
           equipo_id_registrado = NULL,
           pendiente_registro = 1
       WHERE equipo_id_registrado = ?
          OR (? IS NOT NULL AND TRIM(UPPER(service_tag)) = TRIM(UPPER(?)))`,
      [equipoId, serviceTag, serviceTag]
    );
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
      UPDATE equipos
      SET empleado_id = NULL,
          fecha_asig = NULL,
          estado_registro = 'LIBERADO'
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
const accesoId = await obtenerOCrearAccesoEmpleado(empleadoId, data.licencia_office, {
    correoTeams: data.correoTeams ?? null,
    passwordTeams: data.passwordTeams ?? null,
    correoOA: data.correoOA ?? null,
    passwordOA: data.passwordOA ?? null
  });
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
    await db.beginTransaction();

    const marcaId = await obtenerOCrearMarcaModeloEnConexion(
      db,
      equipoId,
      body.equipo.marca,
      body.equipo.modelo
    );

    await db.execute(`
      UPDATE empleados
      SET nombre_completo = ?,
          nomina = ?,
          departamento = ?,
          planta = ?,
          tipo_empleado = ?,
          nombre_gerente = ?
      WHERE empleado_id = ?
    `,[
      body.empleado.nombre_completo,
      body.empleado.nomina ?? null,
      body.empleado.departamento,
      body.empleado.planta,
      body.empleado.tipo_empleado ?? null,
      body.empleado.nombre_gerente ?? null,
      empleadoId
    ]);

    await db.execute(`
        UPDATE equipos
        SET marca_id = ?,
            tipo = ?,
            service_tag = ?,
            nombre_equipo = ?,
            bios_password = ?,
            specs = ?,
            fecha_compra = ?,
            fecha_asig = ?,
            start_warranty = ?,
            end_warranty = ?,
            permiso_salida = ?,
            qr_token = IFNULL(qr_token, UUID())
        WHERE equipo_id = ?
    `,[
      marcaId,
      body.equipo.tipo,
      body.equipo.service_tag,
      body.equipo.nombre_equipo,
      body.equipo.bios_password,
      body.equipo.specs,
      body.equipo.fecha_compra,
      body.equipo.fecha_asig,
      body.equipo.start_warranty,
      body.equipo.end_warranty,
      body.equipo.permiso_salida ?? 0,
      equipoId
    ]);

    await guardarDatosWindowsEnConexion(db, equipoId, body.windows);

    const accesoId = await obtenerOCrearAccesoEmpleadoEnConexion(
      db,
      empleadoId,
      body.equipo.licencia_office,
      body.accesos
    );

    await guardarLicenciaEnrolladoEnConexion(db, accesoId, body.windows);
    await guardarLicenciaNasEnConexion(db, accesoId, body.accesos);
    await guardarLicenciaVpnEnConexion(db, accesoId, body.accesos);
    await guardarLicenciaOsticketEnConexion(db, accesoId, body.accesos);

    await db.commit();

    return {status:'ok'};

  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function obtenerOCrearMarcaModeloEnConexion(db, equipoId, marca, modelo) {
  if (!marca && !modelo) {
    const [equipoRows] = await db.execute(
      `
      SELECT marca_id
      FROM equipos
      WHERE equipo_id = ?
      LIMIT 1
      `,
      [equipoId]
    );

    return equipoRows[0]?.marca_id || null;
  }

  const [rows] = await db.execute(
    `
    SELECT marca_id
    FROM marca_dispositivos
    WHERE TRIM(UPPER(COALESCE(marca, ''))) = TRIM(UPPER(COALESCE(?, '')))
      AND TRIM(UPPER(COALESCE(modelo, ''))) = TRIM(UPPER(COALESCE(?, '')))
    LIMIT 1
    `,
    [marca, modelo]
  );

  if (rows.length > 0) return rows[0].marca_id;

  const [result] = await db.execute(
    `
    INSERT INTO marca_dispositivos (marca, modelo)
    VALUES (?, ?)
    `,
    [marca, modelo]
  );

  return result.insertId;
}

async function guardarDatosWindowsEnConexion(db, equipoId, windows) {
  const [rows] = await db.execute(
    `
    SELECT equipo_id
    FROM datos_windows
    WHERE equipo_id = ?
    LIMIT 1
    `,
    [equipoId]
  );

  const values = [
    windows.usuarioWindows,
    windows.passwordWindows,
    windows.usuarioAdmin,
    windows.passwordAdmin
  ];

  if (rows.length > 0) {
    await db.execute(
      `
      UPDATE datos_windows
      SET local_user_windows = ?,
          password_windows = ?,
          usuario_admin = ?,
          password_admin = ?
      WHERE equipo_id = ?
      `,
      [...values, equipoId]
    );
    return;
  }

  await db.execute(
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
    [equipoId, ...values]
  );
}

async function obtenerOCrearAccesoEmpleadoEnConexion(db, empleadoId, licenciaOffice, accesos = {}) {
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

    const camposExtra = [];
    const valoresExtra = [];

    if (licenciaOffice !== null && licenciaOffice !== undefined) {
      camposExtra.push('licencia_office = ?');
      valoresExtra.push(licenciaOffice);
    }
    if (accesos.correoTeams !== null && accesos.correoTeams !== undefined) {
      camposExtra.push('correo_teams = ?');
      valoresExtra.push(accesos.correoTeams);
    }
    if (accesos.passwordTeams !== null && accesos.passwordTeams !== undefined) {
      camposExtra.push('password_teams = ?');
      valoresExtra.push(accesos.passwordTeams);
    }
    if (accesos.correoOA !== null && accesos.correoOA !== undefined) {
      camposExtra.push('correo_oa = ?');
      valoresExtra.push(accesos.correoOA);
    }
    if (accesos.passwordOA !== null && accesos.passwordOA !== undefined) {
      camposExtra.push('password_oa = ?');
      valoresExtra.push(accesos.passwordOA);
    }

    if (camposExtra.length === 0) return accesoId;

    const setClause = camposExtra.join(', ');

    await db.execute(
      `UPDATE licencias_accesos SET ${setClause} WHERE acceso_id = ?`,
      [...valoresExtra, accesoId]
    );

    return accesoId;
  }

  const [result] = await db.execute(
    `
    INSERT INTO licencias_accesos (
      empleado_id,
      licencia_office,
      correo_teams,
      password_teams,
      correo_oa,
      password_oa
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [empleadoId, licenciaOffice,
     accesos.correoTeams ?? null, accesos.passwordTeams ?? null,
     accesos.correoOA ?? null, accesos.passwordOA ?? null]
  );

  return result.insertId;
}

async function actualizarOInsertarPorAcceso(db, tableName, columns, values, accesoId) {
  const [rows] = await db.execute(
    `
    SELECT acceso_id
    FROM ${tableName}
    WHERE acceso_id = ?
    LIMIT 1
    `,
    [accesoId]
  );

  if (rows.length > 0) {
    const setSql = columns.map((column) => `${column} = ?`).join(', ');

    await db.execute(
      `
      UPDATE ${tableName}
      SET ${setSql}
      WHERE acceso_id = ?
      `,
      [...values, accesoId]
    );
    return;
  }

  await db.execute(
    `
    INSERT INTO ${tableName} (
      acceso_id,
      ${columns.join(', ')}
    )
    VALUES (?, ${columns.map(() => '?').join(', ')})
    `,
    [accesoId, ...values]
  );
}

async function guardarLicenciaEnrolladoEnConexion(db, accesoId, windows) {
  await actualizarOInsertarPorAcceso(
    db,
    'licencia_enrrolado',
    ['correo_enrrolado', 'password_enrrolado'],
    [windows.correoEnrollado, windows.passwordEnrollado],
    accesoId
  );
}

async function guardarLicenciaNasEnConexion(db, accesoId, accesos) {
  await actualizarOInsertarPorAcceso(
    db,
    'licencia_nas',
    ['usuario_nas', 'password_nas'],
    [accesos.usuarioNAS, accesos.passwordNAS],
    accesoId
  );
}

async function guardarLicenciaVpnEnConexion(db, accesoId, accesos) {
  await actualizarOInsertarPorAcceso(
    db,
    'licencia_vpn',
    ['usuario_vpn', 'password_vpn'],
    [accesos.usuarioVPN, accesos.passwordVPN],
    accesoId
  );
}

async function guardarLicenciaOsticketEnConexion(db, accesoId, accesos) {
  await actualizarOInsertarPorAcceso(
    db,
    'licencia_osticket',
    ['usuario_osticket', 'password_osticket'],
    [accesos.usuarioOsticket, accesos.passwordOsticket],
    accesoId
  );
}

async function obtenerOCrearAccesoEmpleado(empleadoId, licenciaOffice = null, accesos = {}) {
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

      const camposExtra = [];
      const valoresExtra = [];

      if (licenciaOffice !== null && licenciaOffice !== undefined) {
        camposExtra.push('licencia_office = ?');
        valoresExtra.push(licenciaOffice);
      }
      if (accesos.correoTeams !== null && accesos.correoTeams !== undefined) {
        camposExtra.push('correo_teams = ?');
        valoresExtra.push(accesos.correoTeams);
      }
      if (accesos.passwordTeams !== null && accesos.passwordTeams !== undefined) {
        camposExtra.push('password_teams = ?');
        valoresExtra.push(accesos.passwordTeams);
      }
      if (accesos.correoOA !== null && accesos.correoOA !== undefined) {
        camposExtra.push('correo_oa = ?');
        valoresExtra.push(accesos.correoOA);
      }
      if (accesos.passwordOA !== null && accesos.passwordOA !== undefined) {
        camposExtra.push('password_oa = ?');
        valoresExtra.push(accesos.passwordOA);
      }

      if (camposExtra.length === 0) return accesoId;

      const setClause = camposExtra.join(', ');

      await db.execute(
        `UPDATE licencias_accesos SET ${setClause} WHERE acceso_id = ?`,
        [...valoresExtra, accesoId]
      );

      return accesoId;
    }

    const columnsExtra = [];
    const insertValoresExtra = [];

    if (accesos.correoTeams !== null && accesos.correoTeams !== undefined) {
      columnsExtra.push('correo_teams');
      insertValoresExtra.push(accesos.correoTeams);
    }
    if (accesos.passwordTeams !== null && accesos.passwordTeams !== undefined) {
      columnsExtra.push('password_teams');
      insertValoresExtra.push(accesos.passwordTeams);
    }
    if (accesos.correoOA !== null && accesos.correoOA !== undefined) {
      columnsExtra.push('correo_oa');
      insertValoresExtra.push(accesos.correoOA);
    }
    if (accesos.passwordOA !== null && accesos.passwordOA !== undefined) {
      columnsExtra.push('password_oa');
      insertValoresExtra.push(accesos.passwordOA);
    }

    const insertColumns = ['empleado_id', 'licencia_office', ...columnsExtra].join(', ');
    const insertPlaceholders = ['?', '?', ...columnsExtra.map(() => '?')].join(', ');

    const [result] = await db.execute(
      `INSERT INTO licencias_accesos (${insertColumns}) VALUES (${insertPlaceholders})`,
      [empleadoId, licenciaOffice || null, ...insertValoresExtra]
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
          emp.nomina,
          emp.tipo_empleado,
          emp.nombre_gerente,
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
        SELECT acceso_id, licencia_office, correo_teams, password_teams, correo_oa, password_oa
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

      const [otrosRows] = await db.execute(
        'SELECT etiqueta, valor FROM accesos_otros WHERE equipo_id = ? ORDER BY id ASC',
        [equipoId]
      );

      return [{
        ...equipo,
        ...(windowsRows[0] || {}),
        licencia_office: acceso?.licencia_office || null,
        correo_teams: acceso?.correo_teams || null,
        password_teams: acceso?.password_teams || null,
        correo_oa: acceso?.correo_oa || null,
        password_oa: acceso?.password_oa || null,
        ...enrrolado,
        ...nas,
        ...vpn,
        ...osticket,
        otros_accesos: otrosRows || []
      }];
    } finally {
      await db.end();
    }
}

  async function obtenerDatosHistorialLiberacion(equipoId) {
    const db = await crearConexion();

    try {
      const [rows] = await db.execute(
        `
        SELECT
          e.equipo_id,
          e.empleado_id,
          e.marca_id AS equipo_marca_id,
          e.service_tag,
          e.serial_number AS equipo_serial_number,
          e.tipo AS equipo_tipo,
          e.nombre_equipo AS equipo_hostname,
          e.hostname_detectado AS equipo_hostname_detectado,
          e.bios_password,
          e.specs AS equipo_specs,

          DATE_FORMAT(e.fecha_compra, '%Y-%m-%d') AS equipo_fecha_compra,
          DATE_FORMAT(e.fecha_asig, '%Y-%m-%d') AS equipo_fecha_asig,
          DATE_FORMAT(e.start_warranty, '%Y-%m-%d') AS equipo_start_warranty,
          DATE_FORMAT(e.end_warranty, '%Y-%m-%d') AS equipo_end_warranty,
          DATE_FORMAT(e.fecha_alta_equipo, '%Y-%m-%d %H:%i:%s') AS equipo_fecha_alta_equipo,

          e.permiso_salida AS equipo_permiso_salida,
          e.qr_token AS equipo_qr_token,
          e.estado_registro AS equipo_estado_registro_anterior,

          emp.nombre_completo AS empleado_nombre,
          emp.departamento AS empleado_departamento,
          emp.planta AS empleado_planta,
          emp.status AS empleado_status,

          md.marca AS equipo_marca,
          md.modelo AS equipo_modelo,

          dw.local_user_windows,
          dw.password_windows,
          dw.usuario_admin,
          dw.password_admin,

          acc.acceso_id,
          acc.licencia_office,

          enr.correo_enrrolado,
          enr.password_enrrolado,

          nas.usuario_nas,
          nas.password_nas,

          vpn.usuario_vpn,
          vpn.password_vpn,

          ost.usuario_osticket,
          ost.password_osticket

        FROM equipos e

        LEFT JOIN empleados emp
          ON emp.empleado_id = e.empleado_id

        LEFT JOIN marca_dispositivos md
          ON md.marca_id = e.marca_id

        LEFT JOIN datos_windows dw
          ON dw.equipo_id = e.equipo_id

        LEFT JOIN licencias_accesos acc
          ON acc.acceso_id = (
            SELECT MAX(la.acceso_id)
            FROM licencias_accesos la
            WHERE la.empleado_id = e.empleado_id
          )

        LEFT JOIN licencia_enrrolado enr
          ON enr.acceso_id = acc.acceso_id

        LEFT JOIN licencia_nas nas
          ON nas.acceso_id = acc.acceso_id

        LEFT JOIN licencia_vpn vpn
          ON vpn.acceso_id = acc.acceso_id

        LEFT JOIN licencia_osticket ost
          ON ost.acceso_id = acc.acceso_id

        WHERE e.equipo_id = ?
        LIMIT 1
        `,
        [equipoId]
      );

      return rows;
    } finally {
      await db.end();
    }
  }

  async function insertarHistorialLiberacion(data) {
    const db = await crearConexion();

    const get = (...keys) => {
      for (const key of keys) {
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
          return data[key];
        }
      }

      return null;
    };

    try {
      const snapshotJson = JSON.stringify(data);

      const [result] = await db.execute(
        `
        INSERT INTO historial_liberaciones (
          equipo_id,
          empleado_id,
          service_tag,
          empleado_nombre,
          empleado_departamento,
          empleado_planta,
          empleado_status,

          equipo_tipo,
          equipo_marca_id,
          equipo_marca,
          equipo_modelo,
          equipo_hostname,
          equipo_hostname_detectado,
          equipo_serial_number,
          equipo_specs,
          bios_password,
          equipo_fecha_compra,
          equipo_fecha_asig,
          equipo_start_warranty,
          equipo_end_warranty,
          equipo_fecha_alta_equipo,
          equipo_permiso_salida,
          equipo_qr_token,
          equipo_estado_registro_anterior,

          local_user_windows,
          password_windows,
          usuario_admin,
          password_admin,

          acceso_id,
          licencia_office,
          correo_enrrolado,
          password_enrrolado,

          usuario_nas,
          password_nas,

          usuario_vpn,
          password_vpn,

          usuario_osticket,
          password_osticket,

          liberado_por,
          tipo_liberador,
          estado,
          fecha_liberacion,
          snapshot_json
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, 'LIBERADO', CURRENT_TIMESTAMP, ?
        )
        `,
        [
          get('equipo_id', 'equipoId'),
          get('empleado_id', 'empleadoId'),
          get('service_tag', 'serviceTag') || 'N/A',
          get('empleado_nombre', 'empleadoNombre'),
          get('empleado_departamento', 'empleadoDepartamento'),
          get('empleado_planta', 'empleadoPlanta'),
          get('empleado_status', 'empleadoStatus'),

          get('equipo_tipo', 'equipoTipo'),
          get('equipo_marca_id', 'equipoMarcaId'),
          get('equipo_marca', 'equipoMarca'),
          get('equipo_modelo', 'equipoModelo'),
          get('equipo_hostname', 'equipoHostname'),
          get('equipo_hostname_detectado', 'equipoHostnameDetectado'),
          get('equipo_serial_number', 'equipoSerialNumber'),
          get('equipo_specs', 'equipoSpecs'),
          get('bios_password', 'biosPassword'),
          get('equipo_fecha_compra', 'equipoFechaCompra'),
          get('equipo_fecha_asig', 'equipoFechaAsig'),
          get('equipo_start_warranty', 'equipoStartWarranty'),
          get('equipo_end_warranty', 'equipoEndWarranty'),
          get('equipo_fecha_alta_equipo', 'equipoFechaAltaEquipo'),
          get('equipo_permiso_salida', 'equipoPermisoSalida'),
          get('equipo_qr_token', 'equipoQrToken'),
          get('equipo_estado_registro_anterior', 'equipoEstadoRegistroAnterior'),

          get('local_user_windows', 'localUserWindows'),
          get('password_windows', 'passwordWindows'),
          get('usuario_admin', 'usuarioAdmin'),
          get('password_admin', 'passwordAdmin'),

          get('acceso_id', 'accesoId'),
          get('licencia_office', 'licenciaOffice'),
          get('correo_enrrolado', 'correoEnrrolado'),
          get('password_enrrolado', 'passwordEnrrolado'),

          get('usuario_nas', 'usuarioNas'),
          get('password_nas', 'passwordNas'),

          get('usuario_vpn', 'usuarioVpn'),
          get('password_vpn', 'passwordVpn'),

          get('usuario_osticket', 'usuarioOsticket'),
          get('password_osticket', 'passwordOsticket'),

          get('liberado_por', 'liberadoPor'),
          get('tipo_liberador', 'tipoLiberador'),
          snapshotJson
        ]
      );

      return result;
    } finally {
      await db.end();
    }
  }

async function actualizarDatosEmpleado(empleadoId, nomina, tipo_empleado, nombre_gerente) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(
      'UPDATE empleados SET nomina = ?, tipo_empleado = ?, nombre_gerente = ? WHERE empleado_id = ?',
      [nomina, tipo_empleado ?? null, nombre_gerente ?? null, empleadoId]
    );
  } catch (err) {
    console.error('[actualizarDatosEmpleado] ERROR:', err.message);
  } finally {
    await db.end();
  }
}

async function insertarOtrosAccesos(equipoId, otros) {
  if (!otros || otros.length === 0) return;
  const db = await crearConexion();
  try {
    for (const item of otros) {
      if (!item.etiqueta?.trim() || !item.valor?.trim()) continue;
      await db.execute(
        'INSERT INTO accesos_otros (equipo_id, etiqueta, valor) VALUES (?, ?, ?)',
        [equipoId, item.etiqueta.trim(), item.valor.trim()]
      );
    }
  } finally {
    await db.end();
  }
}

async function liberarEquipoFisico(equipoId) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      UPDATE equipos
      SET empleado_id = NULL,
          fecha_asig = NULL,
          estado_registro = 'LIBERADO'
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
  actualizarDatosEmpleado,
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
  insertarOtrosAccesos,

  obtenerDatosHistorialLiberacion,
  insertarHistorialLiberacion,

  liberarEquipoFisico
};
