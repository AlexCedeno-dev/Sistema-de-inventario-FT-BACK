const { crearConexion } = require('../configs/db');

function construirActivoFijo(numeroSerie, componenteId) {
  return `FSMX-${numeroSerie}-${componenteId}`;
}

async function crearComponente(datos) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(
      `
      INSERT INTO componentes_manufactura (
        tipo,
        marca,
        modelo,
        numero_serie,
        activo_fijo,
        estado,
        planta,
        notas,
        dado_de_alta_por
      )
      VALUES (?, ?, ?, ?, CONCAT('TEMP-', UUID()), 'DISPONIBLE', ?, ?, ?)
      `,
      [
        datos.tipo,
        datos.marca ?? null,
        datos.modelo ?? null,
        datos.numero_serie,
        datos.planta ?? null,
        datos.notas ?? null,
        datos.dado_de_alta_por ?? null
      ]
    );

    const componenteId = result.insertId;
    const activoFijo = construirActivoFijo(datos.numero_serie, componenteId);

    await db.execute(
      `UPDATE componentes_manufactura SET activo_fijo = ? WHERE componente_id = ?`,
      [activoFijo, componenteId]
    );

    const [rows] = await db.execute(
      `SELECT * FROM componentes_manufactura WHERE componente_id = ? LIMIT 1`,
      [componenteId]
    );

    return rows[0];
  } finally {
    await db.end();
  }
}

async function obtenerComponentePorId(componenteId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(
      `SELECT * FROM componentes_manufactura WHERE componente_id = ? LIMIT 1`,
      [componenteId]
    );

    return rows[0] ?? null;
  } finally {
    await db.end();
  }
}

async function listarComponentes({ tipo, estado, planta } = {}) {
  const db = await crearConexion();

  try {
    const conditions = [];
    const params = [];

    if (tipo) {
      conditions.push('tipo = ?');
      params.push(tipo);
    }
    if (estado) {
      conditions.push('estado = ?');
      params.push(estado);
    }
    if (planta) {
      conditions.push('planta = ?');
      params.push(planta);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await db.execute(
      `SELECT * FROM componentes_manufactura ${where} ORDER BY fecha_alta DESC`,
      params
    );

    return rows;
  } finally {
    await db.end();
  }
}

async function actualizarComponente(componenteId, datos) {
  const CAMPOS_EDITABLES = ['marca', 'modelo', 'numero_serie', 'planta', 'notas', 'estado'];

  const setClauses = [];
  const params = [];

  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      setClauses.push(`${campo} = ?`);
      params.push(datos[campo]);
    }
  }

  if (setClauses.length === 0) return null;

  params.push(componenteId);

  const db = await crearConexion();

  try {
    await db.execute(
      `UPDATE componentes_manufactura SET ${setClauses.join(', ')} WHERE componente_id = ?`,
      params
    );

    const [rows] = await db.execute(
      `SELECT * FROM componentes_manufactura WHERE componente_id = ? LIMIT 1`,
      [componenteId]
    );

    return rows[0] ?? null;
  } finally {
    await db.end();
  }
}

module.exports = {
  construirActivoFijo,
  crearComponente,
  obtenerComponentePorId,
  listarComponentes,
  actualizarComponente,
};
