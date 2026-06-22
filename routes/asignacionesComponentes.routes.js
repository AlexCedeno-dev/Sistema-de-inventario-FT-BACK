const express = require('express');
const router = express.Router();
const asignacionesController = require('../controllers/asignacionesComponentes.controller');

router.get('/manufactura/componentes/disponibles', asignacionesController.obtenerComponentesDisponibles);
router.post('/manufactura/asignaciones', asignacionesController.asignarComponente);
router.get('/manufactura/asignaciones/estacion/:estacionId', asignacionesController.obtenerAsignacionesEstacion);
router.get('/manufactura/asignaciones/empleado/:empleadoId', asignacionesController.obtenerAsignacionesEmpleado);
router.delete('/manufactura/asignaciones/:asignacionId', asignacionesController.liberarAsignacionController);

module.exports = router;
