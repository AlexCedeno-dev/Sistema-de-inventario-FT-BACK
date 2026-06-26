const express = require('express');
const router = express.Router();

const inventarioController = require('../controllers/inventario.controller');
const uploadResponsiva = require('../middlewares/uploadResponsiva');

router.get('/inventario-nuevo', inventarioController.getInventarioNuevo);
router.get('/inventario-viejo', inventarioController.getInventarioViejo);

router.get('/equipos/:equipoId/responsiva-pdf', inventarioController.getResponsivaPDF);

router.post('/equipos/:equipoId/responsiva-firmada', uploadResponsiva.single('archivo'), inventarioController.postSubirResponsivaFirmada);

router.get('/equipos/:equipoId/responsiva-firmada', inventarioController.getResponsivaFirmada);

router.post('/equipos/:equipoId/responsiva-firma-digital', inventarioController.postResponsivaFirmaDigital);


router.post('/equipos/:equipoId/bitlocker', uploadResponsiva.single('archivo'), inventarioController.postSubirBitlocker);

router.get('/equipos/:equipoId/bitlocker', inventarioController.getBitlocker
);

router.post('/equipos/:equipoId/generar-link-firma', inventarioController.postGenerarLinkFirma
);

router.get('/firma/:token/datos', inventarioController.getDatosFirmaToken
);

router.get('/firma/:token/preview', inventarioController.getPreviewFirmaToken);
router.post('/firma/:token/guardar', inventarioController.postGuardarFirmaToken);

router.get('/entregas-historial', inventarioController.getHistorialEntregas);

router.get('/liberaciones-historial', inventarioController.getHistorialLiberaciones);

router.get('/liberaciones-historial/:historialLiberacionId',inventarioController.getDetalleHistorialLiberacion);

router.get('/altas-historial', inventarioController.getHistorialAltas);

router.get('/equipos/qr/:token', inventarioController.getEquipoPorQrToken); 

router.patch('/equipos/:equipoId/permiso-salida', inventarioController.patchPermisoSalida);
router.get('/equipos/:equipoId/qr-etiqueta', inventarioController.getEtiquetaQrPDF);


module.exports = router;