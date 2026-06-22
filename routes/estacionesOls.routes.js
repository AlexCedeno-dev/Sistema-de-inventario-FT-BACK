const express = require('express');
const router = express.Router();
const estacionesOlsController = require('../controllers/estacionesOls.controller');

router.get('/manufactura/estaciones-ols/disponibles', estacionesOlsController.obtenerMonitoreosDisponibles);
router.post('/manufactura/estaciones-ols', estacionesOlsController.altaEstacionOls);
router.get('/manufactura/estaciones-ols', estacionesOlsController.listarEstacionesOlsController);

module.exports = router;
