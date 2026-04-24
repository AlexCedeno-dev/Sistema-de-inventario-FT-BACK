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
          pendiente_registro,
          ignorado
        FROM monitoreo_equipos
        WHERE ignorado = 0
        ORDER BY last_seen DESC
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