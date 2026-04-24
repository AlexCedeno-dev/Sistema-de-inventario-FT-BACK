const { crearConexion, crearConexionOld } = require('../configs/db');

async function obtenerInventarioNuevo() {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT
        e.equipo_id,
        e.empleado_id,
        e.marca_id,
        e.tipo,
        e.service_tag,
        e.serial_number,
        e.fecha_compra,
        e.fecha_asig,
        e.nombre_equipo,
        e.hostname_detectado,
        e.agente_device_id,
        e.registrado_desde,
        e.estado_registro,
        e.fecha_deteccion,
        e.fecha_ultima_conexion,
        e.specs,
        e.start_warranty,
        e.end_warranty,
        e.po_number,
        e.oa_number,
        md.marca,
        md.modelo,
        emp.nombre_completo,
        emp.status,
        emp.departamento,
        emp.planta,
        de.nombre_archivo AS carta_responsiva,
        de.ruta_archivo AS ruta_carta_responsiva
      FROM equipos e
      LEFT JOIN empleados emp
        ON emp.empleado_id = e.empleado_id
      LEFT JOIN marca_dispositivos md
        ON md.marca_id = e.marca_id
      LEFT JOIN (
        SELECT d1.*
        FROM documentos_equipo d1
        INNER JOIN (
          SELECT equipo_id, MAX(documento_id) AS max_id
          FROM documentos_equipo
          WHERE tipo_documento = 'RESPONSIVA_FIRMADA'
          GROUP BY equipo_id
        ) d2
          ON d1.documento_id = d2.max_id
      ) de
        ON de.equipo_id = e.equipo_id
      ORDER BY e.equipo_id DESC
    `);

    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerInventarioViejo() {
  const db = await crearConexionOld();

  try {
    const [rows] = await db.execute(`
      SELECT
        e.equipo_id,
        e.empleado_id,
        e.tipo,
        e.service_tag,
        e.nombre_equipo,
        e.fecha_compra,
        e.fecha_asig,
        e.start_warranty,
        e.end_warranty,
        e.specs,
        md.marca,
        md.modelo,
        emp.nombre_completo,
        emp.status,
        emp.departamento,
        emp.planta
      FROM equipos e
      LEFT JOIN empleados emp
        ON emp.empleado_id = e.empleado_id
      LEFT JOIN marca_dispositivos md
        ON md.marca_id = e.marca_id
      ORDER BY e.equipo_id DESC
    `);

    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerDatosResponsivaPorEquipoId(equipoId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT
        e.equipo_id,
        e.service_tag,
        e.serial_number,
        e.tipo,
        e.nombre_equipo,
        e.hostname_detectado,
        e.specs,
        e.fecha_asig,
        e.fecha_compra,
        e.start_warranty,
        e.end_warranty,
        md.marca,
        md.modelo,
        emp.nombre_completo,
        emp.departamento,
        emp.planta
      FROM equipos e
      LEFT JOIN empleados emp
        ON emp.empleado_id = e.empleado_id
      LEFT JOIN marca_dispositivos md
        ON md.marca_id = e.marca_id
      WHERE e.equipo_id = ?
      LIMIT 1
    `, [equipoId]);

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarDocumentoEquipo({ equipoId, tipoDocumento, nombreArchivo, rutaArchivo }) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(`
      INSERT INTO documentos_equipo (
        equipo_id,
        tipo_documento,
        nombre_archivo,
        ruta_archivo
      )
      VALUES (?, ?, ?, ?)
    `, [equipoId, tipoDocumento, nombreArchivo, rutaArchivo]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerDocumentoResponsivaPorEquipoId(equipoId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT documento_id, nombre_archivo, ruta_archivo, fecha_subida
      FROM documentos_equipo
      WHERE equipo_id = ?
        AND tipo_documento = 'RESPONSIVA_FIRMADA'
      ORDER BY fecha_subida DESC
      LIMIT 1
    `, [equipoId]);

    return rows;
  } finally {
    await db.end();
  }
}

module.exports = {
  obtenerInventarioNuevo,
  obtenerInventarioViejo,
  obtenerDatosResponsivaPorEquipoId,
  insertarDocumentoEquipo,
  obtenerDocumentoResponsivaPorEquipoId
};