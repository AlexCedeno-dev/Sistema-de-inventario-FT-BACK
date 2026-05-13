const { crearConexion } = require('../../../configs/db');
const RULES = require('./home.alertRules');

async function dbRows(sql, params = []) {
  let connection;

  try {
    connection = await crearConexion();

    let result;

    if (typeof connection.execute === 'function') {
      result = await connection.execute(sql, params);
    } else if (typeof connection.query === 'function') {
      result = await connection.query(sql, params);
    } else {
      throw new Error('La conexión no tiene query() ni execute()');
    }

    // mysql2/promise devuelve [rows, fields]
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0];
    }

    return result;
  } finally {
    if (connection) {
      if (typeof connection.end === 'function') {
        await connection.end();
      } else if (typeof connection.release === 'function') {
        connection.release();
      }
    }
  }
}

async function obtenerResumenHome() {
  const totalEquiposSql = `
    SELECT COUNT(*) AS total
    FROM monitoreo_equipos
    WHERE ignorado = 0
  `;

  const equiposOnlineSql = `
    SELECT COUNT(*) AS total
    FROM monitoreo_equipos
    WHERE ignorado = 0
      AND last_seen IS NOT NULL
      AND last_seen >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
  `;

  const inventarioActivoSql = `
    SELECT COUNT(*) AS total
    FROM equipos
    WHERE estado_registro = 'ACTIVO'
  `;

  const [totalEquiposRows, onlineRows, inventarioRows, alertas] = await Promise.all([
    dbRows(totalEquiposSql),
    dbRows(equiposOnlineSql, [RULES.ONLINE_MINUTES]),
    dbRows(inventarioActivoSql),
    obtenerAlertasHome()
  ]);

  const totalEquipos = Number(totalEquiposRows[0]?.total || 0);
  const equiposOnline = Number(onlineRows[0]?.total || 0);
  const inventarioActivo = Number(inventarioRows[0]?.total || 0);

  const alertasCriticas = alertas.filter(a => a.nivel === 'critico').length;
  const equiposOffline = Math.max(totalEquipos - equiposOnline, 0);
  const disponibilidad = totalEquipos > 0
    ? Number(((equiposOnline / totalEquipos) * 100).toFixed(2))
    : 0;

  return {
    totales: {
      totalEquipos,
      equiposOnline,
      inventarioActivo,
      alertasCriticas,
      disponibilidad
    },
    resumenSistema: {
      totalMonitoreados: totalEquipos,
      online: equiposOnline,
      offline: equiposOffline
    }
  };
}

async function obtenerAlertasHome() {
  const [
    alertasGarantia,
    alertasRam,
    alertasOffline
  ] = await Promise.all([
    obtenerAlertasGarantia(),
    obtenerAlertasRam(),
    obtenerAlertasOffline()
  ]);

  const alertas = [
    ...alertasGarantia,
    ...alertasRam,
    ...alertasOffline
  ];

  return alertas.sort((a, b) => {
    const peso = {
      critico: 1,
      advertencia: 2,
      info: 3
    };

    return peso[a.nivel] - peso[b.nivel];
  });
}

async function obtenerAlertasGarantia() {
  const sql = `
    SELECT
      e.equipo_id,
      e.service_tag,
      e.nombre_equipo,
      e.hostname_detectado,
      e.tipo,
      e.end_warranty,
      emp.nombre_completo AS empleado,
      emp.departamento,
      emp.planta,
      DATEDIFF(e.end_warranty, CURDATE()) AS dias_restantes
    FROM equipos e
    LEFT JOIN empleados emp ON emp.empleado_id = e.empleado_id
    WHERE e.estado_registro = 'ACTIVO'
      AND e.end_warranty IS NOT NULL
      AND e.end_warranty <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
  `;

  const rows = await dbRows(sql, [RULES.WARRANTY_WARNING_DAYS]);

  return rows.map(row => {
    const dias = Number(row.dias_restantes);

    let nivel = 'advertencia';
    let mensaje = `La garantía vence en ${dias} días`;

    if (dias < 0) {
      nivel = 'critico';
      mensaje = `La garantía venció hace ${Math.abs(dias)} días`;
    } else if (dias <= RULES.WARRANTY_CRITICAL_DAYS) {
      nivel = 'critico';
      mensaje = `La garantía vence en ${dias} días`;
    }

    return {
      id: `garantia-${row.equipo_id}`,
      tipo: 'garantia',
      nivel,
      equipo_id: row.equipo_id,
      service_tag: row.service_tag,
      hostname: row.hostname_detectado || row.nombre_equipo,
      tipo_equipo: row.tipo,
      empleado: row.empleado || 'Sin empleado asignado',
      departamento: row.departamento || null,
      planta: row.planta || null,
      mensaje,
      valor: dias,
      fecha_limite: row.end_warranty
    };
  });
}

async function obtenerAlertasRam() {
  const sql = `
    SELECT
      m.monitoreo_id,
      m.equipo_id_registrado,
      m.device_id,
      m.service_tag,
      m.hostname,
      m.usuario,
      m.tipo_equipo,
      m.ram_total_gb,
      m.ram_libre_gb,
      m.ram_uso_gb,
      m.ram_porcentaje,
      m.last_seen,
      emp.nombre_completo AS empleado,
      emp.departamento,
      emp.planta
    FROM monitoreo_equipos m
    LEFT JOIN equipos e ON e.equipo_id = m.equipo_id_registrado
    LEFT JOIN empleados emp ON emp.empleado_id = e.empleado_id
        WHERE m.ignorado = 0
        AND m.registrado_en_inventario = 1
        AND m.equipo_id_registrado IS NOT NULL
        AND m.ram_porcentaje IS NOT NULL
        AND m.ram_porcentaje >= ?
  `;

  const rows = await dbRows(sql, [RULES.RAM_WARNING_PERCENT]);

  return rows.map(row => {
    const porcentaje = Number(row.ram_porcentaje);

    const nivel = porcentaje >= RULES.RAM_CRITICAL_PERCENT
      ? 'critico'
      : 'advertencia';

    return {
      id: `ram-${row.monitoreo_id}`,
      tipo: 'ram',
      nivel,
      equipo_id: row.equipo_id_registrado,
      monitoreo_id: row.monitoreo_id,
      device_id: row.device_id,
      service_tag: row.service_tag,
      hostname: row.hostname,
      tipo_equipo: row.tipo_equipo,
      empleado: row.empleado || row.usuario || 'Sin empleado asignado',
      departamento: row.departamento || null,
      planta: row.planta || null,
      mensaje: `Uso de RAM en ${porcentaje}%`,
      valor: porcentaje,
      ram_total_gb: row.ram_total_gb,
      ram_libre_gb: row.ram_libre_gb,
      ram_uso_gb: row.ram_uso_gb,
      last_seen: row.last_seen
    };
  });
}

async function obtenerAlertasOffline() {
        const sql = `
        SELECT
            m.monitoreo_id,
            m.equipo_id_registrado,
            m.device_id,
            m.service_tag,
            m.hostname,
            m.usuario,
            m.tipo_equipo,
            m.last_seen,
            TIMESTAMPDIFF(MINUTE, m.last_seen, NOW()) AS minutos_offline,
            emp.nombre_completo AS empleado,
            emp.departamento,
            emp.planta
        FROM monitoreo_equipos m
        LEFT JOIN equipos e ON e.equipo_id = m.equipo_id_registrado
        LEFT JOIN empleados emp ON emp.empleado_id = e.empleado_id
        WHERE m.ignorado = 0
            AND m.registrado_en_inventario = 1
            AND m.equipo_id_registrado IS NOT NULL
            AND (
            m.last_seen IS NULL
            OR m.last_seen < DATE_SUB(NOW(), INTERVAL ? MINUTE)
            )
        `;

  const rows = await dbRows(sql, [RULES.OFFLINE_WARNING_MINUTES]);

  return rows.map(row => {
    const minutosOffline = row.minutos_offline === null
      ? null
      : Number(row.minutos_offline);

    const horasOffline = minutosOffline === null
      ? null
      : Number((minutosOffline / 60).toFixed(1));

    const nivel = minutosOffline === null || minutosOffline >= RULES.OFFLINE_CRITICAL_HOURS * 60
      ? 'critico'
      : 'advertencia';

    const mensaje = minutosOffline === null
      ? 'El equipo no tiene registro de última conexión'
      : `El equipo lleva ${horasOffline} horas sin reportar`;

    return {
      id: `offline-${row.monitoreo_id}`,
      tipo: 'offline',
      nivel,
      equipo_id: row.equipo_id_registrado,
      monitoreo_id: row.monitoreo_id,
      device_id: row.device_id,
      service_tag: row.service_tag,
      hostname: row.hostname,
      tipo_equipo: row.tipo_equipo,
      empleado: row.empleado || row.usuario || 'Sin empleado asignado',
      departamento: row.departamento || null,
      planta: row.planta || null,
      mensaje,
      valor: minutosOffline,
      horas_offline: horasOffline,
      last_seen: row.last_seen
    };
  });
}

async function obtenerAlertasPendientesRegistro() {
  const sql = `
    SELECT
      m.monitoreo_id,
      m.device_id,
      m.service_tag,
      m.serial_number,
      m.marca,
      m.modelo,
      m.tipo_equipo,
      m.hostname,
      m.usuario,
      m.ip,
      m.mac,
      m.fecha_reporte,
      m.last_seen
    FROM monitoreo_equipos m
    WHERE m.ignorado = 0
      AND m.registrado_en_inventario = 0
      AND m.pendiente_registro = 1
  `;

  const rows = await dbRows(sql);

  return rows.map(row => ({
    id: `pendiente-${row.monitoreo_id}`,
    tipo: 'pendiente_registro',
    nivel: 'advertencia',
    equipo_id: null,
    monitoreo_id: row.monitoreo_id,
    device_id: row.device_id,
    service_tag: row.service_tag,
    serial_number: row.serial_number,
    hostname: row.hostname,
    tipo_equipo: row.tipo_equipo,
    empleado: row.usuario || 'Sin empleado asignado',
    mensaje: 'Equipo detectado por NodeGuard, pero pendiente de registrar en inventario',
    marca: row.marca,
    modelo: row.modelo,
    ip: row.ip,
    mac: row.mac,
    fecha_reporte: row.fecha_reporte,
    last_seen: row.last_seen
  }));
}

async function obtenerActividad24Horas() {
  const nuevosEquiposSql = `
    SELECT COUNT(*) AS total
    FROM equipos
    WHERE fecha_alta_equipo >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `;

  const actualizacionesSql = `
    SELECT COUNT(*) AS total
    FROM monitoreo_equipos
    WHERE actualizado_en >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      AND ignorado = 0
  `;

  const [nuevosRows, actualizacionesRows, alertas] = await Promise.all([
    dbRows(nuevosEquiposSql),
    dbRows(actualizacionesSql),
    obtenerAlertasHome()
  ]);

  return {
    nuevosEquipos: Number(nuevosRows[0]?.total || 0),
    actualizaciones: Number(actualizacionesRows[0]?.total || 0),
    nuevasAlertas: alertas.length
  };
}

async function obtenerActualizacionesRecientes() {
  const registrosSql = `
    SELECT
      e.equipo_id AS referencia_id,
      e.service_tag,
      e.nombre_equipo AS titulo_base,
      emp.nombre_completo AS empleado,
      e.fecha_alta_equipo AS fecha
    FROM equipos e
    LEFT JOIN empleados emp ON emp.empleado_id = e.empleado_id
    WHERE e.fecha_alta_equipo IS NOT NULL
    ORDER BY e.fecha_alta_equipo DESC
    LIMIT 10
  `;

  const monitoreoSql = `
    SELECT
      m.monitoreo_id AS referencia_id,
      m.service_tag,
      m.hostname AS titulo_base,
      m.usuario AS empleado,
      m.actualizado_en AS fecha
    FROM monitoreo_equipos m
    WHERE m.ignorado = 0
      AND m.actualizado_en IS NOT NULL
    ORDER BY m.actualizado_en DESC
    LIMIT 10
  `;

  const [registrosRows, monitoreoRows] = await Promise.all([
    dbRows(registrosSql),
    dbRows(monitoreoSql)
  ]);

  const registros = registrosRows.map(row => ({
    tipo: 'registro',
    titulo: 'Equipo registrado en inventario',
    descripcion: `${row.titulo_base || 'Equipo'} ${row.service_tag ? `(${row.service_tag})` : ''} asignado a ${row.empleado || 'sin empleado'}`,
    referencia_id: row.referencia_id,
    service_tag: row.service_tag,
    fecha: row.fecha
  }));

  const monitoreo = monitoreoRows.map(row => ({
    tipo: 'monitoreo',
    titulo: 'Equipo actualizado por NodeGuard',
    descripcion: `${row.titulo_base || 'Equipo'} ${row.service_tag ? `(${row.service_tag})` : ''} reportó información reciente`,
    referencia_id: row.referencia_id,
    service_tag: row.service_tag,
    fecha: row.fecha
  }));

  return [...registros, ...monitoreo]
    .sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
      const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;

      return fechaB - fechaA;
    })
    .slice(0, 10);
}

module.exports = {
  obtenerResumenHome,
  obtenerAlertasHome,
  obtenerActividad24Horas,
  obtenerActualizacionesRecientes
};