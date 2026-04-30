const { crearConexion } = require('../configs/db');

async function obtenerAgentesDetectados() {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT
        monitoreo_id,
        hostname,
        usuario,
        ip,
        mac,
        service_tag,
        serial_number,
        marca,
        modelo,
        tipo_equipo,
        plataforma,
        tipo_sistema,
        version_windows,
        build_windows,
        edicion_windows,
        cpu_modelo,
        cpu_nucleos,
        cpu_velocidad_mhz,
        ram_total_gb,
        ram_libre_gb,
        ram_uso_gb,
        ram_porcentaje,
        especificacion,
        estado_visual,
        fecha_reporte,
        last_seen,
        registrado_en_inventario,
        equipo_id_registrado,
        ignorado
      FROM monitoreo_equipos
      WHERE ignorado = 0
      ORDER BY last_seen DESC, monitoreo_id DESC
    `);

    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerAgenteParaRegistro(monitoreoId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `
      SELECT
        monitoreo_id,
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
        edicion_windows,
        version_windows,
        build_windows,
        especificacion,
        service_tag,
        serial_number,
        marca,
        modelo,
        tipo_equipo,
        registrado_en_inventario,
        equipo_id_registrado,
        pendiente_registro,
        last_seen,
        fecha_reporte
      FROM monitoreo_equipos
      WHERE monitoreo_id = ?
      LIMIT 1
      `,
      [monitoreoId]
    );

    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerAgentes() {

    const db = await crearConexion();

    try {

        const [rows] = await db.execute(`
          SELECT
            me.monitoreo_id,
            me.hostname,
            me.usuario,
            me.ip,
            me.mac,
            me.service_tag,
            me.serial_number,
            me.marca,
            me.modelo,
            me.tipo_equipo,
            me.plataforma,
            me.tipo_sistema,
            me.version_windows,
            me.build_windows,
            me.edicion_windows,
            me.cpu_modelo,
            me.cpu_nucleos,
            me.cpu_velocidad_mhz,
            me.ram_total_gb,
            me.ram_libre_gb,
            me.ram_uso_gb,
            me.ram_porcentaje,
            me.especificacion,
            me.estado_visual,
            me.fecha_reporte,
            me.last_seen,
            me.registrado_en_inventario,
            me.equipo_id_registrado,
            me.pendiente_registro,
            me.ignorado,
            e.estado_registro AS estado_equipo
          FROM monitoreo_equipos me
          LEFT JOIN equipos e
            ON e.equipo_id = me.equipo_id_registrado
          WHERE me.ignorado = 0
          ORDER BY me.last_seen DESC
        `);

      return rows;

    }
    finally{
      await db.end();
    }

}

module.exports = {
  obtenerAgentesDetectados,
  obtenerAgenteParaRegistro,
  obtenerAgentes
};