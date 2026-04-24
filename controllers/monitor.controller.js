const monitorService = require('../services/monitor.service');

async function monitor(req, res) {
  try {
    const result = await monitorService.procesarMonitor(req.body);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

module.exports = { monitor };