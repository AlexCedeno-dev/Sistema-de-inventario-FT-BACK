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
        e.nombre_equipo,
        e.fecha_asig,
        e.specs,
        e.end_warranty,
        emp.nombre_completo,
        emp.status,
        emp.departamento,
        emp.planta,
        md.marca,
        md.modelo,
        resp.nombre_archivo AS carta_responsiva,
        resp.ruta_archivo AS ruta_carta_responsiva,
        bit.nombre_archivo AS bitlocker,
        bit.ruta_archivo AS ruta_bitlocker
      FROM equipos e
      LEFT JOIN empleados emp
        ON emp.empleado_id = e.empleado_id
      LEFT JOIN marca_dispositivos md
        ON md.marca_id = e.marca_id
      LEFT JOIN documentos_equipo resp
        ON resp.documento_id = (
          SELECT MAX(d.documento_id)
          FROM documentos_equipo d
          WHERE d.equipo_id = e.equipo_id
            AND d.tipo_documento = 'RESPONSIVA_FIRMADA'
        )
      LEFT JOIN documentos_equipo bit
        ON bit.documento_id = (
          SELECT MAX(d.documento_id)
          FROM documentos_equipo d
          WHERE d.equipo_id = e.equipo_id
            AND d.tipo_documento = 'BITLOCKER'
        )
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

async function obtenerDocumentoBitlockerPorEquipoId(equipoId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT documento_id, nombre_archivo, ruta_archivo, fecha_subida
      FROM documentos_equipo
      WHERE equipo_id = ?
        AND tipo_documento = 'BITLOCKER'
      ORDER BY fecha_subida DESC
      LIMIT 1
    `, [equipoId]);

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarFirmaPendiente({ equipoId, token, entregadoPor, tipoEntregador }) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(`
      INSERT INTO firmas_pendientes (
        equipo_id,
        token,
        entregado_por,
        tipo_entregador,
        estado
      )
      VALUES (?, ?, ?, ?, 'PENDIENTE')
    `, [equipoId, token, entregadoPor, tipoEntregador]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerFirmaPendientePorToken(token) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT
        fp.firma_id,
        fp.equipo_id,
        fp.token,
        fp.entregado_por,
        fp.estado,
        e.service_tag,
        e.tipo,
        e.nombre_equipo,
        e.specs,
        md.marca,
        md.modelo,
        emp.nombre_completo,
        emp.departamento,
        emp.planta
      FROM firmas_pendientes fp
      INNER JOIN equipos e
        ON e.equipo_id = fp.equipo_id
      LEFT JOIN empleados emp
        ON emp.empleado_id = e.empleado_id
      LEFT JOIN marca_dispositivos md
        ON md.marca_id = e.marca_id
      WHERE fp.token = ?
      LIMIT 1
    `, [token]);

    return rows;
  } finally {
    await db.end();
  }
}

async function marcarFirmaComoCompletada(token) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(`
      UPDATE firmas_pendientes
      SET estado='ENTREGADO',
          fecha_firma=CURRENT_TIMESTAMP
      WHERE token=?
    `, [token]);

    return result;
  } finally {
    await db.end();
  }
}


async function obtenerHistorialEntregas(filtro) {
  const db = await crearConexion();

  let where = 'DATE(fp.fecha_firma)=CURDATE()';

  if (filtro === 'semana') {
    where = 'YEARWEEK(fp.fecha_firma,1)=YEARWEEK(CURDATE(),1)';
  }

  if (filtro === 'mes') {
    where = `
      MONTH(fp.fecha_firma)=MONTH(CURDATE())
      AND YEAR(fp.fecha_firma)=YEAR(CURDATE())
    `;
  }

  const [rows] = await db.execute(`
    SELECT
      fp.fecha_firma,
      fp.entregado_por,
      fp.tipo_entregador,
      fp.estado,
      e.equipo_id,
      e.service_tag,
      md.marca,
      md.modelo,
      emp.departamento,
      emp.planta,
      emp.nombre_completo
    FROM firmas_pendientes fp
    JOIN equipos e
      ON e.equipo_id = fp.equipo_id
    LEFT JOIN empleados emp
      ON emp.empleado_id = e.empleado_id
    LEFT JOIN marca_dispositivos md
      ON md.marca_id = e.marca_id
    WHERE ${where}
      AND fp.estado IN ('FIRMADO', 'ENTREGADO')
      AND fp.fecha_firma IS NOT NULL
    ORDER BY fp.fecha_firma DESC
  `);

  return rows;
}

module.exports = {
  obtenerInventarioNuevo,
  obtenerInventarioViejo,
  obtenerDatosResponsivaPorEquipoId,
  insertarDocumentoEquipo,
  obtenerDocumentoResponsivaPorEquipoId,
  obtenerDocumentoBitlockerPorEquipoId,
  insertarFirmaPendiente,
  obtenerFirmaPendientePorToken,
  marcarFirmaComoCompletada,

  obtenerHistorialEntregas

};