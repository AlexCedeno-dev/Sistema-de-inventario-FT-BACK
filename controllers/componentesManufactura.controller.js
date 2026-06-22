const { crearComponente, listarComponentes, obtenerComponentePorId, actualizarComponente } = require('../models/componentesManufactura.model');
const { crearConexion } = require('../configs/db');
const { normalizeRol } = require('../middlewares/auth.middleware');

const TIPOS_VALIDOS = ['MONITOR', 'IMPRESORA', 'ESCANER', 'TABLET', 'CELULAR'];

async function registrarAuditoriaComponente({ componenteId, activoFijo, accion, realizadoPor, descripcion, datosAnteriores = null, datosNuevos = null }) {
  try {
    const db = await crearConexion();
    try {
      await db.execute(
        `INSERT INTO auditoria_componentes
           (componente_id, activo_fijo, accion,
            realizado_por_id, realizado_por_nombre, realizado_por_rol,
            descripcion, datos_anteriores, datos_nuevos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          componenteId,
          activoFijo,
          accion,
          realizadoPor?.usuario_id || null,
          realizadoPor?.nombre_completo || 'Desconocido',
          normalizeRol(realizadoPor?.tipo_usuario || ''),
          descripcion || null,
          datosAnteriores || null,
          datosNuevos || null,
        ]
      );
    } finally {
      await db.end();
    }
  } catch (err) {
    console.error('[auditoria_componentes] Error al registrar auditoría:', err.message);
  }
}

async function altaComponente(req, res) {
  try {
    const { tipo, marca, modelo, numero_serie, planta, notas } = req.body;

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `El campo tipo es obligatorio y debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`,
      });
    }

    if (!numero_serie || !numero_serie.trim()) {
      return res.status(400).json({
        error: 'El campo numero_serie es obligatorio.',
      });
    }

    const componente = await crearComponente({
      tipo,
      marca: marca ?? null,
      modelo: modelo ?? null,
      numero_serie: numero_serie.trim(),
      planta: planta ?? null,
      notas: notas ?? null,
      dado_de_alta_por: req.user?.usuario_id ?? null,
    });

    await registrarAuditoriaComponente({
      componenteId: componente.componente_id,
      activoFijo:   componente.activo_fijo,
      accion:       'ALTA',
      realizadoPor: req.user,
      descripcion:  `Alta de componente ${tipo} ${componente.activo_fijo}`,
    });

    return res.status(201).json(componente);
  } catch (error) {
    console.error('[altaComponente] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

const ESTADOS_VALIDOS = ['DISPONIBLE', 'ASIGNADO', 'BAJA'];

async function listarComponentesController(req, res) {
  try {
    const { tipo, estado, planta } = req.query;

    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`,
      });
    }

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`,
      });
    }

    const result = await listarComponentes({ tipo, estado, planta });
    return res.json(result);
  } catch (error) {
    console.error('[listarComponentesController] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function editarComponenteController(req, res) {
  try {
    const componenteId = Number(req.params.id);

    const antes = await obtenerComponentePorId(componenteId);
    if (!antes) {
      return res.status(404).json({ error: 'Componente no encontrado.' });
    }

    const { marca, modelo, numero_serie, planta, notas, estado } = req.body;

    if (numero_serie !== undefined && !numero_serie?.trim()) {
      return res.status(400).json({ error: 'El campo numero_serie no puede estar vacío.' });
    }

    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`,
      });
    }

    const datos = {};
    if (marca        !== undefined) datos.marca        = marca;
    if (modelo       !== undefined) datos.modelo       = modelo;
    if (numero_serie !== undefined) datos.numero_serie = numero_serie.trim();
    if (planta       !== undefined) datos.planta       = planta;
    if (notas        !== undefined) datos.notas        = notas;
    if (estado       !== undefined) datos.estado       = estado;

    const actualizado = await actualizarComponente(componenteId, datos);
    if (!actualizado) {
      return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar.' });
    }

    await registrarAuditoriaComponente({
      componenteId,
      activoFijo:      antes.activo_fijo,
      accion:          'EDICION',
      realizadoPor:    req.user,
      descripcion:     `Edición de componente ${antes.activo_fijo}`,
      datosAnteriores: JSON.stringify(antes),
      datosNuevos:     JSON.stringify(actualizado),
    });

    return res.json(actualizado);
  } catch (error) {
    console.error('[editarComponenteController] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

module.exports = { altaComponente, listarComponentesController, editarComponenteController };
