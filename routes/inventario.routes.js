const express = require('express');
const router = express.Router();

const inventarioController = require('../controllers/inventario.controller');
const uploadResponsiva = require('../middlewares/uploadResponsiva');

router.get('/inventario-nuevo', inventarioController.getInventarioNuevo);
router.get('/inventario-viejo', inventarioController.getInventarioViejo);
router.get('/equipos/:equipoId/responsiva-pdf', inventarioController.getResponsivaPDF);
router.post('/equipos/:equipoId/responsiva-firmada',uploadResponsiva.single('archivo'),inventarioController.postSubirResponsivaFirmada);
router.get('/equipos/:equipoId/responsiva-firmada', inventarioController.getResponsivaFirmada);

module.exports = router;