const inventarioABCService = require('../services/inventarioABC.service');

async function getCategorias(req, res) {
  try {
    const result = await inventarioABCService.listarCategorias();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getInventarioABC(req, res) {
  try {
    const filtros = {
      categoriaId: req.query.categoriaId ? Number(req.query.categoriaId) : null,
      busqueda: req.query.busqueda ? String(req.query.busqueda).trim() : null
    };

    const result = await inventarioABCService.listarInventarioABC(filtros);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getInventarioABCById(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await inventarioABCService.obtenerInventarioABCById(id);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postCrearInventarioABC(req, res) {
  try {
    const result = await inventarioABCService.crearInventarioABC(req.body);
    res.status(201).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function putActualizarInventarioABC(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await inventarioABCService.actualizarInventarioABC(id, req.body);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function deleteInventarioABC(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await inventarioABCService.eliminarInventarioABC(id);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getImagenesInventarioABC(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await inventarioABCService.obtenerImagenesInventarioABC(id);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postSubirImagenesInventarioABC(req, res) {
  try {
    const id = Number(req.params.id);
    const files = req.files || [];
    const result = await inventarioABCService.subirImagenesInventarioABC(id, files);
    res.status(201).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function deleteImagenInventarioABC(req, res) {
  try {
    const imagenId = Number(req.params.imagenId);
    const result = await inventarioABCService.eliminarImagenInventarioABC(imagenId);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postMovimientoInventarioABC(req, res) {
  try {
    const result = await inventarioABCService.registrarMovimientoInventarioABC(req.body);
    res.status(201).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getMovimientosInventarioABC(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await inventarioABCService.obtenerMovimientosInventarioABC(id);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getStocksCategoria(req, res) {
  try {
    const result = await inventarioABCService.obtenerTodosLosStocksCategoria();
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getStockCategoriaById(req, res) {
  try {
    const categoriaId = Number(req.params.categoriaId);
    const result = await inventarioABCService.obtenerStockPorCategoria(categoriaId);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function putActualizarStockCategoria(req, res) {
  try {
    const categoriaId = Number(req.params.categoriaId);
    const stockTotal = Number(req.body.stock_total);

    const result = await inventarioABCService.actualizarStockCategoria(
      categoriaId,
      stockTotal
    );

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postRegistrarPrestamoABC(req, res) {
  try {
    const inventarioId = Number(req.params.id);

    const result = await inventarioABCService.registrarPrestamoABC(
      inventarioId,
      req.body
    );

    res.status(201).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getPrestamosABC(req, res) {
  try {
    const inventarioId = Number(req.params.id);

    const result = await inventarioABCService.listarPrestamosABC(inventarioId);

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function putDevolverPrestamoABC(req, res) {
  try {
    const prestamoId = Number(req.params.prestamoId);

    const result = await inventarioABCService.devolverPrestamoABC(
      prestamoId,
      req.body
    );

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getResumenPrestamosABC(req, res) {
  try {
    const fechaInicio = req.query.fechaInicio;
    const fechaFin = req.query.fechaFin;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        error: 'fechaInicio y fechaFin son requeridos'
      });
    }

    const result = await inventarioABCService.obtenerResumenPrestamos(
      fechaInicio,
      fechaFin
    );

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

module.exports = {
  getCategorias,
  getInventarioABC,
  getInventarioABCById,
  postCrearInventarioABC,
  putActualizarInventarioABC,
  deleteInventarioABC,
  getImagenesInventarioABC,
  postSubirImagenesInventarioABC,
  deleteImagenInventarioABC,
  postMovimientoInventarioABC,
  getMovimientosInventarioABC,
  getStocksCategoria,
  getStockCategoriaById,
  putActualizarStockCategoria,

  postRegistrarPrestamoABC,
  getPrestamosABC,
  putDevolverPrestamoABC,
  getResumenPrestamosABC
};