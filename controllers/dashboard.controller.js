const dashboardService = require('../services/dashboard.service');

async function getDashboard(req, res) {
  try {
    const result = await dashboardService.obtenerDashboard();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getDashboard };