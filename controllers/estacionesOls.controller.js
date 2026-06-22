const { crearConexion } = require('../configs/db');
const {
  obtenerMonitoreosDisponiblesOls,
  registrarEstacionOls,
  listarEstacionesOls,
} = require('../models/estacionesOls.model');

const TIPOS_ESTACION_VALIDOS = ['INYECCION', 'PINTURA', 'ENSAMBLE'];

async function obtenerMonitoreosDisponibles(req, res) {
  try {
    const rows = await obtenerMonitoreosDisponiblesOls();
    return res.json(rows);
  } catch (error) {
    console.error('[obtenerMonitoreosDisponibles] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function altaEstacionOls(req, res) {
  try {
    const { monitoreo_id, nombre_estacion, tipo_estacion, planta, linea, turno } = req.body;

    if (!monitoreo_id) {
      return res.status(400).json({ error: 'El campo monitoreo_id es obligatorio.' });
    }

    // Verificar que el monitoreo exista y no esté ya registrado
    const db = await crearConexion();
    let monitoreo;
    try {
      const [rows] = await db.execute(
        `SELECT * FROM monitoreo_equipos
         WHERE monitoreo_id = ? AND registrado_en_inventario = 0
         LIMIT 1`,
        [monitoreo_id]
      );
      monitoreo = rows[0] ?? null;
    } finally {
      await db.end();
    }

    if (!monitoreo) {
      return res.status(400).json({
        error: 'El monitoreo no existe o ya fue registrado en inventario.',
      });
    }

    if (!nombre_estacion?.trim()) {
      return res.status(400).json({ error: 'El campo nombre_estacion es obligatorio.' });
    }
    if (!tipo_estacion || !TIPOS_ESTACION_VALIDOS.includes(tipo_estacion)) {
      return res.status(400).json({
        error: `El campo tipo_estacion es obligatorio y debe ser uno de: ${TIPOS_ESTACION_VALIDOS.join(', ')}.`,
      });
    }
    if (!planta?.trim()) {
      return res.status(400).json({ error: 'El campo planta es obligatorio.' });
    }

    const resultado = await registrarEstacionOls(
      monitoreo,
      {
        nombre_estacion: nombre_estacion.trim(),
        tipo_estacion,
        planta: planta.trim(),
        linea: linea?.trim() || null,
        turno: turno?.trim() || null,
      },
      req.user.usuario_id,
      req.user.nombre_completo ?? 'Desconocido',
      req.user.tipo_usuario ?? 'Desconocido'
    );

    return res.status(201).json(resultado);
  } catch (error) {
    console.error('[altaEstacionOls] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function listarEstacionesOlsController(req, res) {
  try {
    const rows = await listarEstacionesOls();
    return res.json(rows);
  } catch (error) {
    console.error('[listarEstacionesOlsController] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  obtenerMonitoreosDisponibles,
  altaEstacionOls,
  listarEstacionesOlsController,
};
