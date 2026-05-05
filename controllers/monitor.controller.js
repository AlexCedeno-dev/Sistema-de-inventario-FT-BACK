const monitorService = require('../services/monitor.service');

async function monitor(req, res) {
  try {
    const result = await monitorService.procesarMonitor(req.body);
    res.json(result);
  } catch (error) {
    console.error('ERROR EN /monitor:', error);

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message
    });
  }
}

async function location(req, res) {
  try {
    const result = await monitorService.procesarUbicacion(req.body);
    res.json(result);
  } catch (error) {
    console.error('ERROR EN /monitor/location:', error);

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message
    });
  }
}

module.exports = {
  monitor,
  location
};