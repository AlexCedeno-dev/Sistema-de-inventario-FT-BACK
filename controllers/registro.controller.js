const registroService = require('../services/registro.service');
const { registrarAuditoriaEquipo } = require('../models/auditoria.model');
const { normalizeRol } = require('../middlewares/auth.middleware');

// El service valida tipoLiberador contra ['IT','BECARIO'] (valores legacy).
// Esta función mapea el rol normalizado al valor que el service acepta.
function toLegacyTipo(tipo_usuario) {
  if (!tipo_usuario) return null;
  const norm = normalizeRol(tipo_usuario);
  if (norm === 'ADMIN_IT')   return 'IT';
  if (norm === 'BECARIO_IT') return 'BECARIO';
  return null; // RH u otros no deberían liberar — el service lanzará error
}

async function postRegistrarEquipo(req, res) {
  try {
    const result = await registroService.registrarEquipo(req.body);

    // Auditoría de ALTA — no-throw: si falla no interrumpe el registro
    registrarAuditoriaEquipo({
      equipoId:    result.equipo_id,
      serviceTag:  req.body.equipo?.service_tag || null,
      accion:      'ALTA',
      realizadoPor: req.user,
      descripcion: `Equipo dado de alta por ${req.user?.nombre_completo || 'Desconocido'}`,
      datosNuevos: {
        empleado: req.body.empleado,
        equipo:   req.body.equipo,
      },
    });

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    const payload = { error: error.message };

    if (error.extra) {
      Object.assign(payload, error.extra);
    }

    res.status(statusCode).json(payload);
  }
}

async function postLiberarEquipo(req, res) {
    try {
      const equipoId = Number(req.params.equipoId);

      const {
        liberadoPor:  bodyLiberadoPor,
        tipoLiberador: bodyTipoLiberador,
        liberado_por,
        tipo_liberador
      } = req.body || {};

      // Fuente principal: usuario autenticado.
      // Fallback temporal: body (compatibilidad con frontend actual).
      const liberadoPor =
        req.user?.nombre_completo ||
        bodyLiberadoPor || liberado_por ||
        '';

      // historial_liberaciones solo acepta 'IT' | 'BECARIO' (valores legacy del service).
      const tipoLiberador =
        (req.user ? toLegacyTipo(req.user.tipo_usuario) : null) ||
        bodyTipoLiberador || tipo_liberador ||
        '';

      // Snapshot antes de liberar para datos_anteriores en auditoría
      let snapshotAnterior = null;
      try {
        snapshotAnterior = await registroService.obtenerDetalleEquipo(equipoId);
      } catch (_) {
        // No crítico — la liberación continúa aunque falle el snapshot
      }

      const result = await registroService.liberarEquipo(equipoId, {
        liberadoPor,
        tipoLiberador
      });

      // Auditoría LIBERACION — fire-and-forget
      registrarAuditoriaEquipo({
        equipoId,
        serviceTag:      snapshotAnterior?.service_tag || null,
        accion:          'LIBERACION',
        realizadoPor:    req.user,
        descripcion:     `Equipo liberado por ${req.user?.nombre_completo || liberadoPor}`,
        datosAnteriores: snapshotAnterior,
        datosNuevos: {
          liberado:       true,
          liberado_por:   liberadoPor,
          tipo_liberador: tipoLiberador,
        },
      });

      res.json(result);
    } catch (error) {
      console.error('[liberar] Error completo:', error);
      console.error('[liberar] Stack:', error?.stack);
      const statusCode = error.statusCode || 500;

      const payload = { error: error.message };

      if (error.extra) {
        Object.assign(payload, error.extra);
      }

      res.status(statusCode).json(payload);
    }
}

async function putActualizarEquipo(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);

    // Snapshot antes de editar para datos_anteriores
    let snapshotAnterior = null;
    try {
      snapshotAnterior = await registroService.obtenerDetalleEquipo(equipoId);
    } catch (_) {
      // Si no se puede obtener snapshot, la edición puede continuar igual
    }

    const result = await registroService.actualizarEquipo(equipoId, req.body);

    // Auditoría de EDICION — fire-and-forget
    registrarAuditoriaEquipo({
      equipoId,
      serviceTag:      snapshotAnterior?.service_tag || req.body.equipo?.service_tag || null,
      accion:          'EDICION',
      realizadoPor:    req.user,
      descripcion:     `Equipo editado por ${req.user?.nombre_completo || 'Desconocido'}`,
      datosAnteriores: snapshotAnterior,
      datosNuevos: {
        empleado: req.body.empleado,
        equipo:   req.body.equipo,
      },
    });

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const payload = { error: error.message };

    if (error.extra) Object.assign(payload, error.extra);

    res.status(statusCode).json(payload);
  }
}

async function getDetalleEquipo(req,res){
 try{
   const equipoId = Number(req.params.equipoId);

   const result =
    await registroService.obtenerDetalleEquipo(
      equipoId
    );

   res.json(result);

 }catch(error){

   const statusCode =
   error.statusCode || 500;

   res.status(statusCode).json({
      error:error.message
   });

 }
}

module.exports = {
  postRegistrarEquipo,
  postLiberarEquipo,
  putActualizarEquipo,
  getDetalleEquipo,
};