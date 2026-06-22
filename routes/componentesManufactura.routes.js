const express = require('express');
const router = express.Router();
const componentesController = require('../controllers/componentesManufactura.controller');

router.post('/manufactura/componentes', componentesController.altaComponente);
router.get('/manufactura/componentes', componentesController.listarComponentesController);
router.put('/manufactura/componentes/:id', componentesController.editarComponenteController);

module.exports = router;
