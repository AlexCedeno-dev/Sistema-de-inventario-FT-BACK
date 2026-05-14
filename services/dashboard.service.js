const { crearConexion } = require('../configs/db');
const { calcularEstadoVisual } = require('../helpers/estado.helper');

function toText(value, fallback = null) {
  if (value === undefined || value === null) return fallback;

  const text = String(value).trim();

  if (
    !text ||
    text.toUpperCase() === 'NULL' ||
    text.toUpperCase() === 'N/A'
  ) {
    return fallback;
  }

  return text;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;

  const num = Number(value);

  return Number.isFinite(num) ? num : null;
}

function crearTextoUbicacion(row) {
  const partes = [
    toText(row.ultima_ciudad),
    toText(row.ultima_estado_geo),
    toText(row.ultima_pais)
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(', ') : null;
}

async function obtenerDiscosPorMonitoreo(db, monitoreoIds) {
  if (!Array.isArray(monitoreoIds) || monitoreoIds.length === 0) {
    return new Map();
  }

  const placeholders = monitoreoIds.map(() => '?').join(',');

  const [rows] = await db.execute(
    `
    SELECT
      disco_id,
      monitoreo_id,
      equipo_id,
      service_tag,
      hostname,
      disco,
      \`tamaño_gb\` AS tamano_gb,
      usado_gb,
      porcentaje,
      fecha_reporte
    FROM monitoreo_discos
    WHERE monitoreo_id IN (${placeholders})
    ORDER BY monitoreo_id ASC, disco ASC
    `,
    monitoreoIds
  );

  const map = new Map();

  for (const row of rows) {
    const monitoreoId = row.monitoreo_id;

    if (!map.has(monitoreoId)) {
      map.set(monitoreoId, []);
    }

    map.get(monitoreoId).push({
      disco: toText(row.disco, 'N/A'),
      tamañoGB: toNumber(row.tamano_gb),
      usadoGB: toNumber(row.usado_gb),
      porcentaje: toNumber(row.porcentaje),
      fechaReporte: row.fecha_reporte
    });
  }

  return map;
}

function esErrorConexionTransitorio(error) {
  return [
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
    'ETIMEDOUT',
    'EPIPE'
  ].includes(error?.code);
}

async function obtenerDashboard() {
  const maxIntentos = 2;

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return await obtenerDashboardUnaVez();
    } catch (error) {
      if (intento < maxIntentos && esErrorConexionTransitorio(error)) {
        console.warn(
          `Reintentando /dashboard-monitoreo por error de conexion MySQL (${error.code})`
        );
        continue;
      }

      throw error;
    }
  }
}

async function obtenerDashboardUnaVez() {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT
        m.monitoreo_id,
        m.device_id,
        m.service_tag,
        m.serial_number,
        m.marca,
        m.modelo,
        m.tipo_equipo,
        m.registrado_en_inventario,
        m.equipo_id_registrado,
        m.pendiente_registro,
        m.hostname,
        m.usuario,
        m.ip,
        m.mac,
        m.plataforma,
        m.tipo_sistema,
        m.cpu_modelo,
        m.cpu_nucleos,
        m.cpu_velocidad_mhz,
        m.ram_total_gb,
        m.ram_libre_gb,
        m.ram_uso_gb,
        m.ram_porcentaje,
        m.edicion_windows,
        m.version_windows,
        m.build_windows,
        m.especificacion,
        m.status_agente,
        m.estado_visual,
        m.fecha_reporte,
        m.last_seen,
        m.creado_en,
        m.actualizado_en,

        m.ultima_ip_publica,
        m.ultima_pais,
        m.ultima_estado_geo,
        m.ultima_ciudad,
        m.ultima_latitud,
        m.ultima_longitud,
        m.ultimo_proveedor_internet,
        m.ultima_ubicacion_at,

        e.equipo_id,
        e.empleado_id,
        e.nombre_equipo,
        e.fecha_asig,

        emp.nombre_completo AS empleado_nombre,
        emp.departamento AS empleado_departamento,
        emp.planta AS empleado_planta,
        emp.status AS empleado_status

        FROM monitoreo_equipos m
        INNER JOIN equipos e
          ON e.equipo_id = m.equipo_id_registrado
        INNER JOIN empleados emp
          ON emp.empleado_id = e.empleado_id
        WHERE m.registrado_en_inventario = 1
          AND e.empleado_id IS NOT NULL
        ORDER BY m.last_seen DESC, m.monitoreo_id DESC
    `);

    const monitoreoIds = rows.map((row) => row.monitoreo_id).filter(Boolean);
    const discosPorMonitoreo = await obtenerDiscosPorMonitoreo(db, monitoreoIds);

    const resultado = rows.map((row) => {
      const estadoCalculado = calcularEstadoVisual(row.last_seen);
      const online = estadoCalculado === 'online';

      return {
        monitoreoId: row.monitoreo_id,
        equipoIdRegistrado: row.equipo_id_registrado,

        hostname: toText(row.hostname, 'N/A'),
        ip: toText(row.ip, 'N/A'),
        mac: toText(row.mac, 'N/A'),
        usuario: toText(row.usuario, 'N/A'),

        serviceTag: toText(row.service_tag, 'N/A'),
        serialNumber: toText(row.serial_number, 'N/A'),
        deviceId: toText(row.device_id, 'N/A'),

        marca: toText(row.marca, 'N/A'),
        modelo: toText(row.modelo, 'N/A'),
        tipoEquipo: toText(row.tipo_equipo, 'N/A'),

        registradoNuevo: row.registrado_en_inventario === 1,
        pendienteRegistro: row.pendiente_registro === 1,

        empleado: toText(row.empleado_nombre, 'No asignado'),
        idEmpleado: row.empleado_id ?? null,
        departamento: toText(row.empleado_departamento, 'N/A'),
        planta: toText(row.empleado_planta, 'N/A'),
        statusEmpleado: toText(row.empleado_status, 'N/A'),

        nombreEquipoInventario: toText(row.nombre_equipo, 'N/A'),
        fechaAsignacion: row.fecha_asig ?? null,

        plataforma: toText(row.plataforma, 'N/A'),
        tipoSistema: toText(row.tipo_sistema, 'N/A'),

        uptime: null,

        fecha: row.fecha_reporte ?? null,
        lastSeen: row.last_seen ?? null,

        estado: online ? '🟢 Online' : '🔴 Offline',
        estadoVisual: estadoCalculado,
        statusAgente: online ? 'ACTIVO' : 'INACTIVO',

        cpu: {
          modelo: toText(row.cpu_modelo, 'N/A'),
          nucleos: toNumber(row.cpu_nucleos),
          velocidad_mhz: toNumber(row.cpu_velocidad_mhz),
          temperatura: null
        },

        ram: {
          totalGB: toNumber(row.ram_total_gb),
          libreGB: toNumber(row.ram_libre_gb),
          usoGB: toNumber(row.ram_uso_gb),
          porcentaje: toNumber(row.ram_porcentaje)
        },

        discos: discosPorMonitoreo.get(row.monitoreo_id) || [],

        sistema: {
          edicion: toText(row.edicion_windows, 'N/A'),
          version: toText(row.version_windows, 'N/A'),
          build: toText(row.build_windows, 'N/A'),
          especificacion: toText(row.especificacion, 'N/A'),
          idDispositivo: toText(row.device_id, 'N/A'),
          idProducto: toText(row.serial_number, 'N/A')
        },

        ubicacion: {
          texto: crearTextoUbicacion(row),
          ipPublica: toText(row.ultima_ip_publica, 'N/A'),
          pais: toText(row.ultima_pais, 'N/A'),
          estado: toText(row.ultima_estado_geo, 'N/A'),
          ciudad: toText(row.ultima_ciudad, 'N/A'),
          latitud: toNumber(row.ultima_latitud),
          longitud: toNumber(row.ultima_longitud),
          proveedor: toText(row.ultimo_proveedor_internet, 'N/A'),
          ultimaUbicacionAt: row.ultima_ubicacion_at ?? null,
          fuente: 'IP pública aproximada'
        }
      };
    });

    return resultado;
  } finally {
    await db.end();
  }
}

module.exports = {
  obtenerDashboard
};
