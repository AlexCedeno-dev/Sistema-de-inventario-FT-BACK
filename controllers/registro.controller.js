const registroService = require('../services/registro.service');

async function postRegistrarEquipo(req, res) {
  try {
    const result = await registroService.registrarEquipo(req.body);
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
    const result = await registroService.liberarEquipo(equipoId);
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

async function putActualizarEquipo(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const result = await registroService.actualizarEquipo(equipoId, req.body);
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