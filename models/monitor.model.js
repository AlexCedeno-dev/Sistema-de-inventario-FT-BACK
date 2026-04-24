const { crearConexion } = require('../configs/db');

async function buscarEquipoPorServiceTag(serviceTag) {
  const db = await crearConexion();

  const [rows] = await db.execute(
    `SELECT equipo_id FROM equipos WHERE TRIM(UPPER(service_tag)) = TRIM(UPPER(?)) LIMIT 1`,
    [serviceTag]
  );

  await db.end();
  return rows;
}

async function buscarMonitoreoPorHostname(hostname) {
  const db = await crearConexion();

  const [rows] = await db.execute(
    `SELECT monitoreo_id FROM monitoreo_equipos WHERE TRIM(UPPER(hostname)) = TRIM(UPPER(?)) LIMIT 1`,
    [hostname]
  );

  await db.end();
  return rows;
}

module.exports = {
  buscarEquipoPorServiceTag,
  buscarMonitoreoPorHostname
};