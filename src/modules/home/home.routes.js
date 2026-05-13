const express = require('express');
const router = express.Router();

const homeController = require('./home.controller');

router.get('/resumen', homeController.getResumenHome);
router.get('/alertas', homeController.getAlertasHome);
router.get('/actividad', homeController.getActividadHome);
router.get('/recientes', homeController.getActualizacionesRecientes);

module.exports = router;