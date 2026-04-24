const { crearConexion } = require('../configs/db');
const { calcularEstadoVisual } = require('../helpers/estado.helper');

async function obtenerDashboard() {
  const dbNew = await crearConexion();

  try {
    const [monitoreoRows] = await dbNew.execute(`
      SELECT *
      FROM monitoreo_equipos
      WHERE registrado_en_inventario = 1
      ORDER BY last_seen DESC, monitoreo_id DESC
    `);

    const resultado = monitoreoRows.map((row) => {
      const online = calcularEstadoVisual(row.last_seen) === 'online';

      return {
        hostname: row.hostname ?? 'N/A',
        ip: row.ip ?? 'N/A',
        usuario: row.usuario ?? 'N/A',
        serviceTag: row.service_tag ?? 'N/A',
        estado: online ? '🟢 Online' : '🔴 Offline'
      };
    });

    return resultado;

  } finally {
    await dbNew.end();
  }
}

module.exports = {
  obtenerDashboard
};