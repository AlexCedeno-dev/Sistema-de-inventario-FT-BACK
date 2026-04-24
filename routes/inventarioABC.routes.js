const express = require('express');
const router = express.Router();

const inventarioABCController = require('../controllers/inventarioABC.controller');
const uploadABC = require('../middlewares/uploadABC');

router.get('/inventario-abc/categorias', inventarioABCController.getCategorias);

router.get('/inventario-abc/stocks', inventarioABCController.getStocksCategoria);
router.get('/inventario-abc/stocks/:categoriaId', inventarioABCController.getStockCategoriaById);
router.put('/inventario-abc/stocks/:categoriaId', inventarioABCController.putActualizarStockCategoria);

router.get('/inventario-abc/prestamos/resumen', inventarioABCController.getResumenPrestamosABC);
router.put('/inventario-abc/prestamos/:prestamoId/devolver', inventarioABCController.putDevolverPrestamoABC);

router.post('/inventario-abc/:id/prestamos', inventarioABCController.postRegistrarPrestamoABC);
router.get('/inventario-abc/:id/prestamos', inventarioABCController.getPrestamosABC);

router.get('/inventario-abc', inventarioABCController.getInventarioABC);
router.get('/inventario-abc/:id', inventarioABCController.getInventarioABCById);
router.post('/inventario-abc', inventarioABCController.postCrearInventarioABC);
router.put('/inventario-abc/:id', inventarioABCController.putActualizarInventarioABC);
router.delete('/inventario-abc/:id', inventarioABCController.deleteInventarioABC);

router.get('/inventario-abc/:id/imagenes', inventarioABCController.getImagenesInventarioABC);
router.post(
  '/inventario-abc/:id/imagenes',
  uploadABC.array('imagenes', 10),
  inventarioABCController.postSubirImagenesInventarioABC
);
router.delete('/inventario-abc/imagenes/:imagenId', inventarioABCController.deleteImagenInventarioABC);

router.post('/inventario-abc/movimientos', inventarioABCController.postMovimientoInventarioABC);
router.get('/inventario-abc/:id/movimientos', inventarioABCController.getMovimientosInventarioABC);

module.exports = router;