const {
  obtenerServiceTag,
  obtenerHostname,
  obtenerUsuario,
  obtenerIP,
  obtenerMAC,
  obtenerPlataforma,
  obtenerTipoSistema,
  obtenerCpuModelo,
  obtenerCpuNucleos,
  obtenerCpuVelocidad,
  obtenerDecimal
} = require('../helpers/normalizadores.helper');

const { calcularEstadoVisual } = require('../helpers/estado.helper');
const { crearConexion } = require('../configs/db');

const VALORES_INVALIDOS = new Set([
  '',
  'N/A',
  'NA',
  'NULL',
  'UNDEFINED',
  'UNKNOWN',
  'TO BE FILLED BY O.E.M.',
  'NONE',
  'SIN SERVICE TAG'
]);

function limpiarTexto(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function limpiarIdentificador(value) {
  const text = limpiarTexto(value, '');
  if (!text) return null;

  const upper = text.toUpperCase();
  if (VALORES_INVALIDOS.has(upper)) return null;

  return text;
}

function obtenerNumero(value) {
  if (value === undefined || value === null || value === '') return null;

  const num = Number(String(value).replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function obtenerEntero(value) {
  const num = obtenerNumero(value);
  return num === null ? null : Math.trunc(num);
}

async function buscarEquipoIdPorServiceTag(db, serviceTag) {
  if (!serviceTag) return null;

  const [rows] = await db.execute(
    `SELECT e.equipo_id
     FROM equipos e
     INNER JOIN empleados emp
       ON emp.empleado_id = e.empleado_id
     WHERE TRIM(UPPER(e.service_tag)) = TRIM(UPPER(?))
       AND e.empleado_id IS NOT NULL
     LIMIT 1`,
    [serviceTag]
  );

  return rows.length > 0 ? rows[0].equipo_id : null;
}

async function buscarMonitoreoExistente(db, { serviceTag, mac, hostname }) {
  let rows = [];

  if (serviceTag) {
    [rows] = await db.execute(
      `SELECT monitoreo_id, equipo_id_registrado
       FROM monitoreo_equipos
       WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?))
       LIMIT 1`,
      [serviceTag]
    );

    if (rows.length > 0) return rows[0];
  }

  if (mac) {
    [rows] = await db.execute(
      `SELECT monitoreo_id, equipo_id_registrado
       FROM monitoreo_equipos
       WHERE TRIM(UPPER(mac)) = TRIM(UPPER(?))
       LIMIT 1`,
      [mac]
    );

    if (rows.length > 0) return rows[0];
  }

  if (hostname) {
    [rows] = await db.execute(
      `SELECT monitoreo_id, equipo_id_registrado
       FROM monitoreo_equipos
       WHERE TRIM(UPPER(hostname)) = TRIM(UPPER(?))
       LIMIT 1`,
      [hostname]
    );

    if (rows.length > 0) return rows[0];
  }

  return null;
}

function normalizarDiscos(discos) {
  if (!Array.isArray(discos)) return [];

  return discos
    .map((d) => ({
      disco: limpiarTexto(d?.disco ?? d?.fs ?? d?.mount ?? ''),
      tamañoGB: obtenerNumero(d?.tamañoGB ?? d?.tamanoGB ?? d?.sizeGB ?? d?.tamaño_gb),
      usadoGB: obtenerNumero(d?.usadoGB ?? d?.usedGB ?? d?.usado_gb),
      porcentaje: obtenerNumero(d?.porcentaje ?? d?.use)
    }))
    .filter((d) => d.disco);
}

async function guardarDiscos(db, { monitoreoId, equipoId, serviceTag, hostname, discos }) {
  if (!monitoreoId) return 0;

  const discosNormalizados = normalizarDiscos(discos);

  await db.execute(
    `DELETE FROM monitoreo_discos
     WHERE monitoreo_id = ?`,
    [monitoreoId]
  );

  if (discosNormalizados.length === 0) return 0;

  for (const disco of discosNormalizados) {
    await db.execute(
      `INSERT INTO monitoreo_discos (
        monitoreo_id,
        equipo_id,
        service_tag,
        hostname,
        disco,
        \`tamaño_gb\`,
        usado_gb,
        porcentaje,
        fecha_reporte
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        monitoreoId,
        equipoId,
        serviceTag,
        hostname,
        disco.disco,
        disco.tamañoGB,
        disco.usadoGB,
        disco.porcentaje
      ]
    );
  }

  return discosNormalizados.length;
}

async function procesarMonitor(data) {
  const hostname = limpiarTexto(obtenerHostname(data), '');

  if (!hostname) {
    const error = new Error('hostname es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  const serviceTag = limpiarIdentificador(
    obtenerServiceTag(data) || data?.service_tag || data?.serial_number
  );

  const usuario = limpiarTexto(obtenerUsuario(data), 'N/A');
  const ip = limpiarTexto(obtenerIP(data), '0.0.0.0');
  const mac = limpiarIdentificador(obtenerMAC(data));
  const plataforma = limpiarTexto(obtenerPlataforma(data), 'N/A');
  const tipoSistema = limpiarTexto(obtenerTipoSistema(data), 'N/A');

  const cpuModelo = limpiarTexto(obtenerCpuModelo(data), 'N/A');
  const cpuNucleos = obtenerEntero(obtenerCpuNucleos(data));
  const cpuVelocidad = obtenerEntero(obtenerCpuVelocidad(data));

  const marca = limpiarTexto(data?.marca ?? data?.system?.manufacturer ?? data?.fabricante ?? '');
  const modelo = limpiarTexto(data?.modelo ?? data?.system?.model ?? '');
  const serialNumber = limpiarIdentificador(
    data?.serial_number ?? data?.bios?.serialNumber ?? data?.serialNumber ?? serviceTag
  );

  const tipoEquipo = limpiarTexto(data?.tipo_equipo ?? data?.system?.chassisType ?? '');
  const edicionWindows = limpiarTexto(data?.edicion_windows ?? data?.os?.edition ?? '');
  const versionWindows = limpiarTexto(data?.version_windows ?? data?.os?.version ?? '');
  const buildWindows = limpiarTexto(data?.build_windows ?? data?.os?.build ?? '');
  const especificacion = limpiarTexto(data?.especificacion ?? data?.specs ?? '');

  const ramTotal = obtenerDecimal(data?.ram_total_gb ?? data?.ram?.totalGB);
  const ramLibre = obtenerDecimal(data?.ram_libre_gb ?? data?.ram?.libreGB);
  const ramUso = obtenerDecimal(data?.ram_uso_gb ?? data?.ram?.usoGB);
  const ramPorcentaje = obtenerDecimal(data?.ram_porcentaje ?? data?.ram?.porcentaje);

  const deviceId = limpiarIdentificador(data?.device_id) || serviceTag || mac || hostname;

  const ahora = new Date();
  const db = await crearConexion();

  try {
    await db.beginTransaction();

    const equipoIdRegistrado = await buscarEquipoIdPorServiceTag(db, serviceTag);
    const registradoEnInventario = equipoIdRegistrado ? 1 : 0;
    const pendienteRegistro = registradoEnInventario ? 0 : 1;

    const estadoVisual = calcularEstadoVisual(ahora);
    const statusAgente = estadoVisual === 'online' ? 'ACTIVO' : 'INACTIVO';

    const existente = await buscarMonitoreoExistente(db, {
      serviceTag,
      mac,
      hostname
    });

    let monitoreoId = null;

    if (existente) {
      monitoreoId = existente.monitoreo_id;

      await db.execute(
        `UPDATE monitoreo_equipos
         SET device_id = ?,
             hostname = ?,
             usuario = ?,
             ip = ?,
             mac = ?,
             plataforma = ?,
             tipo_sistema = ?,
             cpu_modelo = ?,
             cpu_nucleos = ?,
             cpu_velocidad_mhz = ?,
             ram_total_gb = ?,
             ram_libre_gb = ?,
             ram_uso_gb = ?,
             ram_porcentaje = ?,
             marca = ?,
             modelo = ?,
             serial_number = ?,
             tipo_equipo = ?,
             edicion_windows = ?,
             version_windows = ?,
             build_windows = ?,
             especificacion = ?,
             status_agente = ?,
             estado_visual = ?,
             fecha_reporte = ?,
             last_seen = ?,
             service_tag = ?,
             registrado_en_inventario = ?,
             equipo_id_registrado = ?,
             pendiente_registro = ?,
             ignorado = 0,
             alerta_mostrada = 0
         WHERE monitoreo_id = ?`,
        [
          deviceId,
          hostname,
          usuario,
          ip,
          mac,
          plataforma,
          tipoSistema,
          cpuModelo,
          cpuNucleos,
          cpuVelocidad,
          ramTotal,
          ramLibre,
          ramUso,
          ramPorcentaje,
          marca,
          modelo,
          serialNumber,
          tipoEquipo,
          edicionWindows,
          versionWindows,
          buildWindows,
          especificacion,
          statusAgente,
          estadoVisual,
          ahora,
          ahora,
          serviceTag,
          registradoEnInventario,
          equipoIdRegistrado,
          pendienteRegistro,
          monitoreoId
        ]
      );
    } else {
      const [insertResult] = await db.execute(
        `INSERT INTO monitoreo_equipos (
          device_id,
          hostname,
          usuario,
          ip,
          mac,
          plataforma,
          tipo_sistema,
          cpu_modelo,
          cpu_nucleos,
          cpu_velocidad_mhz,
          ram_total_gb,
          ram_libre_gb,
          ram_uso_gb,
          ram_porcentaje,
          marca,
          modelo,
          serial_number,
          tipo_equipo,
          edicion_windows,
          version_windows,
          build_windows,
          especificacion,
          status_agente,
          estado_visual,
          fecha_reporte,
          last_seen,
          service_tag,
          registrado_en_inventario,
          equipo_id_registrado,
          pendiente_registro,
          ignorado,
          alerta_mostrada
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          deviceId,
          hostname,
          usuario,
          ip,
          mac,
          plataforma,
          tipoSistema,
          cpuModelo,
          cpuNucleos,
          cpuVelocidad,
          ramTotal,
          ramLibre,
          ramUso,
          ramPorcentaje,
          marca,
          modelo,
          serialNumber,
          tipoEquipo,
          edicionWindows,
          versionWindows,
          buildWindows,
          especificacion,
          statusAgente,
          estadoVisual,
          ahora,
          ahora,
          serviceTag,
          registradoEnInventario,
          equipoIdRegistrado,
          pendienteRegistro
        ]
      );

      monitoreoId = insertResult.insertId;
    }

    const discosGuardados = await guardarDiscos(db, {
      monitoreoId,
      equipoId: equipoIdRegistrado,
      serviceTag,
      hostname,
      discos: data?.discos
    });

    await db.commit();

    return {
      status: 'ok',
      monitoreo_id: monitoreoId,
      hostname,
      serviceTag,
      registrado_en_inventario: registradoEnInventario,
      pendiente_registro: pendienteRegistro,
      discos_guardados: discosGuardados
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function procesarUbicacion(data) {
  const hostname = limpiarTexto(data?.hostname ?? obtenerHostname(data), '');
  const serviceTag = limpiarIdentificador(
    data?.service_tag ?? data?.serviceTag ?? data?.serial_number ?? obtenerServiceTag(data)
  );
  const mac = limpiarIdentificador(data?.mac ?? obtenerMAC(data));
  const usuario = limpiarTexto(data?.usuario_windows ?? data?.usuario ?? obtenerUsuario(data), 'N/A');
  const ipLocal = limpiarTexto(data?.ip_local ?? data?.ip ?? obtenerIP(data), '0.0.0.0');

  const ipPublica = limpiarTexto(data?.ip_publica ?? data?.public_ip ?? data?.ipPublica ?? '');
  const pais = limpiarTexto(data?.pais ?? data?.country_name ?? data?.country ?? '');
  const estado = limpiarTexto(data?.estado ?? data?.region ?? data?.regionName ?? '');
  const ciudad = limpiarTexto(data?.ciudad ?? data?.city ?? '');
  const codigoPostal = limpiarTexto(data?.codigo_postal ?? data?.postal ?? data?.zip ?? '');
  const latitud = obtenerNumero(data?.latitud ?? data?.latitude ?? data?.lat);
  const longitud = obtenerNumero(data?.longitud ?? data?.longitude ?? data?.lon);
  const proveedor = limpiarTexto(data?.proveedor ?? data?.org ?? data?.isp ?? '');
  const timezone = limpiarTexto(data?.timezone ?? data?.time_zone ?? '');
  const fuente = limpiarTexto(data?.fuente ?? 'IP_PUBLICA', 'IP_PUBLICA');

  if (!hostname && !serviceTag && !mac) {
    const error = new Error('Se requiere hostname, service_tag o mac para guardar ubicación');
    error.statusCode = 400;
    throw error;
  }

  const ahora = new Date();
  const db = await crearConexion();

  try {
    await db.beginTransaction();

    let equipoId = await buscarEquipoIdPorServiceTag(db, serviceTag);

    let existente = await buscarMonitoreoExistente(db, {
      serviceTag,
      mac,
      hostname
    });

    let monitoreoId = existente?.monitoreo_id || null;

    if (!equipoId && existente?.equipo_id_registrado) {
      equipoId = existente.equipo_id_registrado;
    }

    if (!monitoreoId) {
      const deviceId = serviceTag || mac || hostname;
      const registradoEnInventario = equipoId ? 1 : 0;
      const pendienteRegistro = registradoEnInventario ? 0 : 1;

      const [insertResult] = await db.execute(
        `INSERT INTO monitoreo_equipos (
          device_id,
          service_tag,
          serial_number,
          registrado_en_inventario,
          equipo_id_registrado,
          pendiente_registro,
          ignorado,
          alerta_mostrada,
          hostname,
          usuario,
          ip,
          mac,
          status_agente,
          estado_visual,
          fecha_reporte,
          last_seen,
          ultima_ip_publica,
          ultima_pais,
          ultima_estado_geo,
          ultima_ciudad,
          ultima_latitud,
          ultima_longitud,
          ultimo_proveedor_internet,
          ultima_ubicacion_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'ACTIVO', 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          serviceTag,
          serviceTag,
          registradoEnInventario,
          equipoId,
          pendienteRegistro,
          hostname,
          usuario,
          ipLocal,
          mac,
          ahora,
          ahora,
          ipPublica,
          pais,
          estado,
          ciudad,
          latitud,
          longitud,
          proveedor,
          ahora
        ]
      );

      monitoreoId = insertResult.insertId;
    } else {
      await db.execute(
        `UPDATE monitoreo_equipos
         SET ultima_ip_publica = ?,
             ultima_pais = ?,
             ultima_estado_geo = ?,
             ultima_ciudad = ?,
             ultima_latitud = ?,
             ultima_longitud = ?,
             ultimo_proveedor_internet = ?,
             ultima_ubicacion_at = ?,
             ip = ?,
             usuario = ?,
             mac = ?,
             status_agente = 'ACTIVO',
             estado_visual = 'online',
             last_seen = ?
         WHERE monitoreo_id = ?`,
        [
          ipPublica,
          pais,
          estado,
          ciudad,
          latitud,
          longitud,
          proveedor,
          ahora,
          ipLocal,
          usuario,
          mac,
          ahora,
          monitoreoId
        ]
      );
    }

    await db.execute(
      `INSERT INTO ubicaciones_equipo (
        equipo_id,
        monitoreo_id,
        service_tag,
        hostname,
        usuario_windows,
        ip_local,
        ip_publica,
        pais,
        estado,
        ciudad,
        codigo_postal,
        latitud,
        longitud,
        proveedor,
        timezone,
        fuente,
        fecha_registro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipoId,
        monitoreoId,
        serviceTag,
        hostname,
        usuario,
        ipLocal,
        ipPublica,
        pais,
        estado,
        ciudad,
        codigoPostal,
        latitud,
        longitud,
        proveedor,
        timezone,
        fuente,
        ahora
      ]
    );

    await db.commit();

    return {
      status: 'ok',
      monitoreo_id: monitoreoId,
      equipo_id: equipoId,
      hostname,
      serviceTag,
      ubicacion: {
        ip_publica: ipPublica,
        pais,
        estado,
        ciudad,
        latitud,
        longitud,
        proveedor,
        timezone,
        fecha_registro: ahora
      }
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

module.exports = {
  procesarMonitor,
  procesarUbicacion
};