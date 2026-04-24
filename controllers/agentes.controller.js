const agentesService = require('../services/agentes.service');

async function getAgentesDetectados(req, res) {
  try {
    const result = await agentesService.listarAgentesDetectados();
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getRegistrarEquipoDesdeAgente(req, res) {
  try {
    const monitoreoId = Number(req.params.monitoreoId);
    const result = await agentesService.obtenerDatosRegistroDesdeAgente(monitoreoId);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getAgentesDetectados(req,res){

  try{

    const result=
        await agentesService.listarAgentesAgrupados();

    res.json(result);

  }
  catch(error){

    const statusCode =
        error.statusCode || 500;

    res.status(statusCode).json({
        error:error.message
    });

 }

}


module.exports = {
  getAgentesDetectados,
  getRegistrarEquipoDesdeAgente,
  getAgentesDetectados
};