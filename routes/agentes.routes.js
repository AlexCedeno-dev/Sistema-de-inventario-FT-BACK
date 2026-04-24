const express = require('express');
const router = express.Router();
const agentesController = require('../controllers/agentes.controller');

router.get('/', agentesController.getAgentesDetectados);
router.get('/registrar-equipo-desde-agente/:monitoreoId', agentesController.getRegistrarEquipoDesdeAgente);
router.get('/registro/:monitoreoId', agentesController.getRegistrarEquipoDesdeAgente);

module.exports = router;