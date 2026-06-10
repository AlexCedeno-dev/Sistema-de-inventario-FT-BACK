const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');

const monitorRoutes = require('./monitor.routes');
const agentesRoutes = require('./agentes.routes');
const registroRoutes = require('./registro.routes');
const inventarioRoutes = require('./inventario.routes');
const dashboardRoutes = require('./dashboard.routes');
const homeRoutes = require('../src/modules/home/home.routes');
const inventarioController = require('../controllers/inventario.controller');

const { requireAuth } = require('../middlewares/auth.middleware');

// Login / sesión
router.use('/auth', authRoutes);

// Ruta pública del agente NodeGuard
// No la protegemos con login porque el agente manda su propio token
router.use('/monitor', monitorRoutes);

router.get('/firma/:token/datos', inventarioController.getDatosFirmaToken);
router.post('/firma/:token/guardar', inventarioController.postGuardarFirmaToken);
router.get('/equipos/qr/:token', inventarioController.getEquipoPorQrToken);

// Rutas protegidas del sistema
router.use('/agentes', requireAuth, agentesRoutes);
router.use('/home', requireAuth, homeRoutes);

router.use('/', requireAuth, registroRoutes);
router.use('/', requireAuth, inventarioRoutes);
router.use('/', requireAuth, dashboardRoutes);

module.exports = router;
