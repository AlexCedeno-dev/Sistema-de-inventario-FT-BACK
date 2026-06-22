const {
  obtenerComponentesDisponiblesPorTipo,
  crearAsignacion,
  listarAsignacionesPorEstacion,
  listarAsignacionesPorEmpleado,
  liberarAsignacion,
} = require('../models/asignacionesComponentes.model');

const TIPOS_COMPONENTE_VALIDOS = ['MONITOR', 'IMPRESORA', 'ESCANER', 'TABLET', 'CELULAR'];

async function obtenerComponentesDisponibles(req, res) {
  try {
    const { tipo } = req.query;
    if (tipo && !TIPOS_COMPONENTE_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `tipo inválido. Valores permitidos: ${TIPOS_COMPONENTE_VALIDOS.join(', ')}.`,
      });
    }
    const rows = await obtenerComponentesDisponiblesPorTipo(tipo ?? null);
    return res.json(rows);
  } catch (error) {
    console.error('[obtenerComponentesDisponibles] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function asignarComponente(req, res) {
  try {
    const { componente_id, tipo_destino, estacion_id, empleado_id } = req.body;
    if (!componente_id) {
      return res.status(400).json({ error: 'El campo componente_id es obligatorio.' });
    }
    if (!tipo_destino) {
      return res.status(400).json({ error: 'El campo tipo_destino es obligatorio.' });
    }
    const resultado = await crearAsignacion(
      { componente_id, tipo_destino, estacion_id: estacion_id ?? null, empleado_id: empleado_id ?? null },
      req.user.usuario_id
    );
    return res.status(201).json(resultado);
  } catch (error) {
    console.error('[asignarComponente] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function obtenerAsignacionesEstacion(req, res) {
  try {
    const { estacionId } = req.params;
    const rows = await listarAsignacionesPorEstacion(estacionId);
    return res.json(rows);
  } catch (error) {
    console.error('[obtenerAsignacionesEstacion] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function obtenerAsignacionesEmpleado(req, res) {
  try {
    const { empleadoId } = req.params;
    const rows = await listarAsignacionesPorEmpleado(empleadoId);
    return res.json(rows);
  } catch (error) {
    console.error('[obtenerAsignacionesEmpleado] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function liberarAsignacionController(req, res) {
  try {
    const { asignacionId } = req.params;
    const resultado = await liberarAsignacion(
      asignacionId,
      req.user.usuario_id,
      req.user.nombre_completo ?? 'Desconocido',
      req.user.tipo_usuario ?? 'Desconocido'
    );
    return res.json(resultado);
  } catch (error) {
    console.error('[liberarAsignacionController] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

module.exports = {
  obtenerComponentesDisponibles,
  asignarComponente,
  obtenerAsignacionesEstacion,
  obtenerAsignacionesEmpleado,
  liberarAsignacionController,
};
