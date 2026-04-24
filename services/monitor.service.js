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

async function procesarMonitor(data) {
  const hostname = obtenerHostname(data);

  if (!hostname) {
    const error = new Error('hostname es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  const serviceTag = obtenerServiceTag(data);
  const deviceId = serviceTag;
  const usuario = obtenerUsuario(data);
  const ip = obtenerIP(data);
  const mac = obtenerMAC(data);
  const plataforma = obtenerPlataforma(data);
  const tipoSistema = obtenerTipoSistema(data);
  const cpuModelo = obtenerCpuModelo(data);
  const cpuNucleos = obtenerCpuNucleos(data);
  const cpuVelocidad = obtenerCpuVelocidad(data);

  const marca = data?.marca ?? data?.system?.manufacturer ?? data?.fabricante ?? '';
  const modelo = data?.modelo ?? data?.system?.model ?? '';
  const serialNumber = data?.serial_number ?? data?.bios?.serialNumber ?? data?.serialNumber ?? '';
  const tipoEquipo = data?.tipo_equipo ?? data?.system?.chassisType ?? '';
  const edicionWindows = data?.edicion_windows ?? data?.os?.edition ?? '';
  const versionWindows = data?.version_windows ?? data?.os?.version ?? '';
  const buildWindows = data?.build_windows ?? data?.os?.build ?? '';
  const especificacion = data?.especificacion ?? data?.specs ?? '';

  const ramTotal = obtenerDecimal(data?.ram_total_gb ?? data?.ram?.totalGB);
  const ramLibre = obtenerDecimal(data?.ram_libre_gb ?? data?.ram?.libreGB);
  const ramUso = obtenerDecimal(data?.ram_uso_gb ?? data?.ram?.usoGB);
  const ramPorcentaje = obtenerDecimal(data?.ram_porcentaje ?? data?.ram?.porcentaje);

  const ahora = new Date();

  const db = await crearConexion();

  try {
    let registradoEnInventario = 0;
    let equipoIdRegistrado = null;

    if (serviceTag) {
      const [rows] = await db.execute(
        `SELECT equipo_id
         FROM equipos
         WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?))
         LIMIT 1`,
        [serviceTag]
      );

      if (rows.length > 0) {
        registradoEnInventario = 1;
        equipoIdRegistrado = rows[0].equipo_id;
      }
    }

    const pendienteRegistro = registradoEnInventario ? 0 : 1;
    const estadoVisual = calcularEstadoVisual(ahora);
    const statusAgente = estadoVisual === 'online' ? 'ACTIVO' : 'INACTIVO';

    let existente = [];

    if (serviceTag) {
      [existente] = await db.execute(
        `SELECT monitoreo_id
         FROM monitoreo_equipos
         WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?))
         LIMIT 1`,
        [serviceTag]
      );
    }

    if (existente.length === 0 && mac) {
      [existente] = await db.execute(
        `SELECT monitoreo_id
         FROM monitoreo_equipos
         WHERE TRIM(UPPER(mac)) = TRIM(UPPER(?))
         LIMIT 1`,
        [mac]
      );
    }

    if (existente.length === 0) {
      [existente] = await db.execute(
        `SELECT monitoreo_id
         FROM monitoreo_equipos
         WHERE TRIM(UPPER(hostname)) = TRIM(UPPER(?))
         LIMIT 1`,
        [hostname]
      );
    }

    if (existente.length > 0) {
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
          existente[0].monitoreo_id
        ]
      );
    } else {
      await db.execute(
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
    }

    return {
      status: 'ok',
      hostname,
      serviceTag,
      registrado_en_inventario: registradoEnInventario,
      pendiente_registro: pendienteRegistro
    };
  } finally {
    await db.end();
  }
}

module.exports = {
  procesarMonitor
};