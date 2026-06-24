const express = require('express');
const router = express.Router();
const estacionesOlsController = require('../controllers/estacionesOls.controller');

router.get('/manufactura/estaciones-ols/disponibles', estacionesOlsController.obtenerMonitoreosDisponibles);
router.get('/manufactura/estaciones-ols/:estacionId/qr-etiqueta', estacionesOlsController.getEtiquetaQrOLSPDF);
router.post('/manufactura/estaciones-ols', estacionesOlsController.altaEstacionOls);
router.get('/manufactura/estaciones-ols', estacionesOlsController.listarEstacionesOlsController);
router.post('/manufactura/estaciones-ols/:estacionId/baja', estacionesOlsController.postDarBajaEstacionOls);
router.post('/manufactura/estaciones-ols/:estacionId/reactivar', estacionesOlsController.postReactivarEstacionOls);
router.put('/manufactura/estaciones-ols/:estacionId', estacionesOlsController.putEditarEstacionOls);

module.exports = router;
