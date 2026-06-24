const { crearConexion } = require('../configs/db');
const crypto = require('crypto');

async function obtenerOCrearMarcaEnConexion(db, marca, modelo) {
  if (!marca) return null;
  const [rows] = await db.execute(
    `SELECT marca_id FROM marca_dispositivos
     WHERE TRIM(UPPER(COALESCE(marca,''))) = TRIM(UPPER(COALESCE(?,'')))
       AND TRIM(UPPER(COALESCE(modelo,''))) = TRIM(UPPER(COALESCE(?,'')))
     LIMIT 1`,
    [marca, modelo ?? '']
  );
  if (rows.length > 0) return rows[0].marca_id;
  const [result] = await db.execute(
    `INSERT INTO marca_dispositivos (marca, modelo) VALUES (?, ?)`,
    [marca, modelo ?? null]
  );
  return result.insertId;
}

async function obtenerMonitoreosDisponiblesOls() {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT
        monitoreo_id,
        device_id,
        service_tag,
        serial_number,
        marca,
        modelo,
        hostname,
        ip,
        cpu_modelo AS cpu,
        ram_total_gb AS ram,
        last_seen AS ultima_conexion,
        tipo_equipo
      FROM monitoreo_equipos
      WHERE ignorado = 0
        AND registrado_en_inventario = 0
        AND TRIM(UPPER(tipo_equipo)) IN ('DESKTOP', 'MINI PC')
        AND NOT EXISTS (
          SELECT 1 FROM equipos e
          WHERE TRIM(UPPER(e.service_tag COLLATE utf8mb4_general_ci)) = TRIM(UPPER(monitoreo_equipos.service_tag COLLATE utf8mb4_general_ci))
        )
      ORDER BY last_seen DESC
    `);

    const ahora = new Date();
    return rows.filter((r) => {
      if (!r.ultima_conexion) return false;
      const segundos = (ahora.getTime() - new Date(r.ultima_conexion).getTime()) / 1000;
      return segundos <= 150;
    });
  } finally {
    await db.end();
  }
}

async function registrarEstacionOls(datosMonitoreo, datosOls, usuarioId, usuarioNombre, usuarioRol) {
  const db = await crearConexion();
  try {
    await db.beginTransaction();

    const [existeEquipo] = await db.execute(
      `SELECT equipo_id FROM equipos WHERE service_tag = ? LIMIT 1`,
      [datosMonitoreo.service_tag]
    );
    if (existeEquipo.length > 0) {
      const err = new Error(
        `El equipo con service tag ${datosMonitoreo.service_tag} ya está registrado en inventario.`
      );
      err.statusCode = 409;
      throw err;
    }

    const qrToken = crypto.randomUUID();
    const specs = datosMonitoreo.cpu_modelo
      ? `CPU: ${datosMonitoreo.cpu_modelo} | RAM: ${datosMonitoreo.ram_total_gb ?? '?'} GB`
      : null;

    const marcaId = await obtenerOCrearMarcaEnConexion(
      db,
      datosMonitoreo.marca ?? null,
      datosMonitoreo.modelo ?? null
    );

    const nombreEquipo =
      datosMonitoreo.hostname?.trim() || datosOls.nombre_estacion;

    const fechaCompra = datosOls.fecha_compra ?? new Date().toISOString().slice(0, 10);

    const [equipoResult] = await db.execute(
      `INSERT INTO equipos (
        tipo,
        service_tag,
        serial_number,
        marca_id,
        nombre_equipo,
        hostname_detectado,
        agente_device_id,
        specs,
        qr_token,
        fecha_compra,
        start_warranty,
        end_warranty,
        permiso_salida,
        estado_registro,
        registrado_desde,
        fecha_alta_equipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'activo', 'agente', NOW())`,
      [
        'OLS',
        datosMonitoreo.service_tag ?? null,
        datosMonitoreo.serial_number ?? null,
        marcaId,
        nombreEquipo,
        datosMonitoreo.hostname ?? null,
        datosMonitoreo.device_id ?? null,
        specs,
        qrToken,
        fechaCompra,
        datosOls.start_warranty ?? null,
        datosOls.end_warranty ?? null,
      ]
    );

    const equipoId = equipoResult.insertId;

    // Insertar en estaciones_ols con activo_fijo temporal, luego UPDATE
    const [estacionResult] = await db.execute(
      `INSERT INTO estaciones_ols (
        equipo_id,
        activo_fijo,
        nombre_estacion,
        tipo_estacion,
        planta,
        linea,
        turno,
        dado_de_alta_por
      ) VALUES (?, CONCAT('TEMP-', UUID()), ?, ?, ?, ?, ?, ?)`,
      [
        equipoId,
        datosOls.nombre_estacion,
        datosOls.tipo_estacion,
        datosOls.planta ?? null,
        datosOls.linea ?? null,
        datosOls.turno ?? null,
        usuarioId,
      ]
    );

    const estacionId = estacionResult.insertId;
    const serviceTagParaActivo = datosMonitoreo.service_tag ?? String(equipoId);
    const activoFijo = `FSMX-${serviceTagParaActivo}-${equipoId}`;

    await db.execute(
      `UPDATE estaciones_ols SET activo_fijo = ? WHERE estacion_id = ?`,
      [activoFijo, estacionId]
    );

    // Marcar monitoreo como registrado
    await db.execute(
      `UPDATE monitoreo_equipos
       SET registrado_en_inventario = 1,
           pendiente_registro = 0,
           equipo_id_registrado = ?,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE monitoreo_id = ?`,
      [equipoId, datosMonitoreo.monitoreo_id]
    );

    // Auditoría
    await db.execute(
      `INSERT INTO auditoria_equipos (
        equipo_id, service_tag, accion,
        realizado_por_id, realizado_por_nombre, realizado_por_rol, descripcion
      ) VALUES (?, ?, 'ALTA', ?, ?, ?, ?)`,
      [
        equipoId,
        datosMonitoreo.service_tag ?? null,
        usuarioId,
        usuarioNombre ?? 'Desconocido',
        usuarioRol ?? 'Desconocido',
        `Alta de estación OLS ${datosOls.nombre_estacion} desde agente`,
      ]
    );

    await db.commit();

    return {
      equipo: {
        equipo_id: equipoId,
        tipo: 'OLS',
        service_tag: datosMonitoreo.service_tag ?? null,
        qr_token: qrToken,
      },
      estacion_ols: {
        estacion_id: estacionId,
        equipo_id: equipoId,
        activo_fijo: activoFijo,
        nombre_estacion: datosOls.nombre_estacion,
        tipo_estacion: datosOls.tipo_estacion,
        planta: datosOls.planta ?? null,
        linea: datosOls.linea ?? null,
        turno: datosOls.turno ?? null,
      },
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function listarEstacionesOls(estado = 'ACTIVA') {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(
      `SELECT
        s.estacion_id,
        s.nombre_estacion,
        s.tipo_estacion,
        s.planta,
        s.linea,
        s.turno,
        s.estado,
        s.activo_fijo,
        s.equipo_id,
        s.fecha_alta,
        e.qr_token,
        e.service_tag,
        md.marca,
        md.modelo,
        e.hostname_detectado,
        e.fecha_compra,
        e.start_warranty,
        e.end_warranty,
        e.estado_registro,
        me.last_seen,
        comp.total_componentes
      FROM estaciones_ols s
      INNER JOIN equipos e ON e.equipo_id = s.equipo_id
      LEFT JOIN marca_dispositivos md ON md.marca_id = e.marca_id
      LEFT JOIN monitoreo_equipos me ON me.equipo_id_registrado = s.equipo_id
      LEFT JOIN (
        SELECT estacion_id, COUNT(*) AS total_componentes
        FROM asignaciones_componentes
        WHERE estado = 'ACTIVA' AND tipo_destino = 'ESTACION_OLS'
        GROUP BY estacion_id
      ) comp ON comp.estacion_id = s.estacion_id
      WHERE s.estado = ?
      ORDER BY s.fecha_alta DESC`,
      [estado]
    );
    return rows;
  } finally {
    await db.end();
  }
}

async function darBajaEstacionOls(estacionId) {
  const db = await crearConexion();
  try {
    await db.beginTransaction();

    const [rows] = await db.execute(
      `SELECT s.*, e.service_tag
       FROM estaciones_ols s
       INNER JOIN equipos e ON e.equipo_id = s.equipo_id
       WHERE s.estacion_id = ? LIMIT 1`,
      [estacionId]
    );

    if (rows.length === 0) {
      const err = new Error(`Estación OLS con id ${estacionId} no encontrada.`);
      err.statusCode = 404;
      throw err;
    }

    const snapshot = rows[0];

    if (snapshot.estado === 'BAJA') {
      const err = new Error(`La estación OLS ${estacionId} ya está dada de baja.`);
      err.statusCode = 409;
      throw err;
    }

    await db.execute(
      `UPDATE estaciones_ols SET estado = 'BAJA' WHERE estacion_id = ?`,
      [estacionId]
    );

    await db.execute(
      `UPDATE equipos SET estado_registro = 'LIBERADO' WHERE equipo_id = ?`,
      [snapshot.equipo_id]
    );

    await db.commit();
    return snapshot;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function reactivarEstacionOls(estacionId) {
  const db = await crearConexion();
  try {
    await db.beginTransaction();

    const [rows] = await db.execute(
      `SELECT s.*, e.service_tag
       FROM estaciones_ols s
       INNER JOIN equipos e ON e.equipo_id = s.equipo_id
       WHERE s.estacion_id = ? LIMIT 1`,
      [estacionId]
    );

    if (rows.length === 0) {
      const err = new Error(`Estación OLS con id ${estacionId} no encontrada.`);
      err.statusCode = 404;
      throw err;
    }

    const snapshot = rows[0];

    if (snapshot.estado === 'ACTIVA') {
      const err = new Error(`La estación OLS ${estacionId} ya está activa.`);
      err.statusCode = 409;
      throw err;
    }

    await db.execute(
      `UPDATE estaciones_ols SET estado = 'ACTIVA' WHERE estacion_id = ?`,
      [estacionId]
    );

    await db.execute(
      `UPDATE equipos SET estado_registro = 'activo' WHERE equipo_id = ?`,
      [snapshot.equipo_id]
    );

    await db.commit();
    return snapshot;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function actualizarEstacionOls(estacionId, datosNuevos) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(
      `SELECT s.*, e.service_tag
       FROM estaciones_ols s
       INNER JOIN equipos e ON e.equipo_id = s.equipo_id
       WHERE s.estacion_id = ? LIMIT 1`,
      [estacionId]
    );

    if (rows.length === 0) {
      const err = new Error(`Estación OLS con id ${estacionId} no encontrada.`);
      err.statusCode = 404;
      throw err;
    }

    const snapshot = rows[0];

    await db.execute(
      `UPDATE estaciones_ols
       SET nombre_estacion = ?,
           tipo_estacion   = ?,
           planta          = ?,
           linea           = ?,
           turno           = ?
       WHERE estacion_id   = ?`,
      [
        datosNuevos.nombre_estacion,
        datosNuevos.tipo_estacion,
        datosNuevos.planta,
        datosNuevos.linea  ?? null,
        datosNuevos.turno  ?? null,
        estacionId,
      ]
    );

    return snapshot;
  } catch (error) {
    throw error;
  } finally {
    await db.end();
  }
}

module.exports = {
  obtenerMonitoreosDisponiblesOls,
  registrarEstacionOls,
  listarEstacionesOls,
  darBajaEstacionOls,
  reactivarEstacionOls,
  actualizarEstacionOls,
};
