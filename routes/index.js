const express = require('express');
const router = express.Router();

const monitorRoutes = require('./monitor.routes');
const agentesRoutes = require('./agentes.routes');
const registroRoutes = require('./registro.routes');
const inventarioRoutes = require('./inventario.routes');
const dashboardRoutes = require('./dashboard.routes');
const inventarioABCRoutes = require('./inventarioABC.routes');

router.use('/monitor', monitorRoutes);
router.use('/agentes', agentesRoutes);
router.use('/', registroRoutes);
router.use('/', inventarioRoutes);
router.use('/', dashboardRoutes);
router.use('/', inventarioABCRoutes);

module.exports = router;