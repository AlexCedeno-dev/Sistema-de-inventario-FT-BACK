const express = require('express');
const router = express.Router();
const registroController = require('../controllers/registro.controller');

router.post('/registrar-equipo', registroController.postRegistrarEquipo);
router.post('/equipos/:equipoId/liberar', registroController.postLiberarEquipo);

module.exports = router;