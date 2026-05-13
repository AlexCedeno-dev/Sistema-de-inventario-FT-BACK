const homeService = require('./home.service');

async function getResumenHome(req, res) {
  try {
    const data = await homeService.obtenerResumenHome();
    res.json(data);
  } catch (error) {
    console.error('[HomeController] Error en getResumenHome:', error);
    res.status(500).json({
      error: 'Error al obtener el resumen de Home',
      detalle: error.message
    });
  }
}

async function getAlertasHome(req, res) {
  try {
    const data = await homeService.obtenerAlertasHome();
    res.json(data);
  } catch (error) {
    console.error('[HomeController] Error en getAlertasHome:', error);
    res.status(500).json({
      error: 'Error al obtener las alertas de Home',
      detalle: error.message
    });
  }
}

async function getActividadHome(req, res) {
  try {
    const data = await homeService.obtenerActividad24Horas();
    res.json(data);
  } catch (error) {
    console.error('[HomeController] Error en getActividadHome:', error);
    res.status(500).json({
      error: 'Error al obtener actividad de últimas 24 horas',
      detalle: error.message
    });
  }
}

async function getActualizacionesRecientes(req, res) {
  try {
    const data = await homeService.obtenerActualizacionesRecientes();
    res.json(data);
  } catch (error) {
    console.error('[HomeController] Error en getActualizacionesRecientes:', error);
    res.status(500).json({
      error: 'Error al obtener actualizaciones recientes',
      detalle: error.message
    });
  }
}

module.exports = {
  getResumenHome,
  getAlertasHome,
  getActividadHome,
  getActualizacionesRecientes
};