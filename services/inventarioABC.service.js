const fs = require('fs');
const inventarioABCModel = require('../models/inventarioABC.model');

function validarId(id, nombre = 'ID') {
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${nombre} inválido`);
    error.statusCode = 400;
    throw error;
  }
}

async function listarCategorias() {
  return await inventarioABCModel.obtenerCategorias();
}

async function listarInventarioABC(filtros) {
  return await inventarioABCModel.obtenerInventarioABC(filtros);
}

async function obtenerInventarioABCById(id) {
  validarId(id, 'ID de inventario');

  const rows = await inventarioABCModel.obtenerInventarioABCById(id);

  if (!rows || rows.length === 0) {
    const error = new Error('Artículo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function crearInventarioABC(data) {
  const categoriaId = Number(data.categoria_id);
  const cantidad = Number(data.cantidad);

  validarId(categoriaId, 'Categoría');

  if (!data.nombre || !String(data.nombre).trim()) {
    const error = new Error('El nombre es requerido');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(cantidad) || cantidad < 0) {
    const error = new Error('La cantidad debe ser un número válido');
    error.statusCode = 400;
    throw error;
  }
  
  const duplicado = await inventarioABCModel.buscarArticuloDuplicado({
    categoria_id: categoriaId,
    nombre: String(data.nombre).trim(),
    modelo: data.modelo ? String(data.modelo).trim() : '',
    descripcion: data.descripcion ? String(data.descripcion).trim() : '',
    estado_equipo: data.estado_equipo ? String(data.estado_equipo).trim() : ''
  });

  if (duplicado && duplicado.length > 0) {
    const error = new Error('El artículo ya existe en el inventario');
    error.statusCode = 409;
    throw error;
  }

  const stockRows = await inventarioABCModel.obtenerStockPorCategoriaId(categoriaId);

  if (!stockRows || stockRows.length === 0) {
    const error = new Error('Stock de categoría no configurado');
    error.statusCode = 400;
    throw error;
  }

  const stock = stockRows[0];
  const piezasRegistradas = Number(stock.piezas_registradas);
  const stockTotal = Number(stock.stock_total);

    if (piezasRegistradas + cantidad > stockTotal) {
      if (data.auto_stock === true) {
        const nuevoStockTotal = piezasRegistradas + cantidad;

        await inventarioABCModel.actualizarStockTotalCategoria(
          categoriaId,
          nuevoStockTotal
        );
      } else {
        const error = new Error('Stock completo, favor de editar el número de stock');
        error.statusCode = 400;
        throw error;
      }
    }

  const result = await inventarioABCModel.insertarInventarioABC({
    categoria_id: categoriaId,
    cantidad,
    nombre: String(data.nombre).trim(),
    marca: data.marca ? String(data.marca).trim() : null,
    modelo: data.modelo ? String(data.modelo).trim() : null,
    descripcion: data.descripcion ? String(data.descripcion).trim() : null,
    estado_equipo: data.estado_equipo ? String(data.estado_equipo).trim() : null,
    ticket_asignacion: data.ticket_asignacion ? String(data.ticket_asignacion).trim() : null,
    solicitado_por: data.solicitado_por ? String(data.solicitado_por).trim() : null,
    observaciones: data.observaciones ? String(data.observaciones).trim() : null
  });

  return {
    status: 'ok',
    inventario_abc_id: result.insertId
  };
}

async function actualizarInventarioABC(id, data) {
  validarId(id, 'ID de inventario');

  const existente = await inventarioABCModel.obtenerInventarioABCById(id);
  if (!existente || existente.length === 0) {
    const error = new Error('Artículo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const itemActual = existente[0];

  const categoriaId = Number(data.categoria_id);
  const cantidad = Number(data.cantidad);

  validarId(categoriaId, 'Categoría');

  if (!data.nombre || !String(data.nombre).trim()) {
    const error = new Error('El nombre es requerido');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(cantidad) || cantidad < 0) {
    const error = new Error('La cantidad debe ser un número válido');
    error.statusCode = 400;
    throw error;
  }

  const stockRows = await inventarioABCModel.obtenerStockPorCategoriaId(categoriaId);

  if (!stockRows || stockRows.length === 0) {
    const error = new Error('Stock de categoría no configurado');
    error.statusCode = 400;
    throw error;
  }

  const stock = stockRows[0];
  const piezasRegistradas = Number(stock.piezas_registradas);
  const stockTotal = Number(stock.stock_total);

  const cantidadAnterior = Number(itemActual.cantidad);
  const categoriaAnterior = Number(itemActual.categoria_id);

  let nuevoTotalCategoria = piezasRegistradas;

  if (categoriaAnterior === categoriaId) {
    nuevoTotalCategoria = piezasRegistradas - cantidadAnterior + cantidad;
  } else {
    nuevoTotalCategoria = piezasRegistradas + cantidad;
  }

  if (nuevoTotalCategoria > stockTotal) {
    const error = new Error('Stock completo, favor de editar el número de stock');
    error.statusCode = 400;
    throw error;
  }

  if (cantidadAnterior !== cantidad) {
    await inventarioABCModel.insertarMovimientoABC({
      inventario_abc_id: id,
      tipo_movimiento: 'ajuste',
      cantidad,
      numero_ticket: data.ticket_asignacion ? String(data.ticket_asignacion).trim() : null,
      solicitado_por: data.solicitado_por ? String(data.solicitado_por).trim() : null,
      comentario: 'Ajuste manual desde edición de artículo'
    });
  }

  await inventarioABCModel.actualizarInventarioABC(id, {
    categoria_id: categoriaId,
    cantidad,
    nombre: String(data.nombre).trim(),
    marca: data.marca ? String(data.marca).trim() : null,
    modelo: data.modelo ? String(data.modelo).trim() : null,
    descripcion: data.descripcion ? String(data.descripcion).trim() : null,
    estado_equipo: data.estado_equipo ? String(data.estado_equipo).trim() : null,
    ticket_asignacion: data.ticket_asignacion ? String(data.ticket_asignacion).trim() : null,
    solicitado_por: data.solicitado_por ? String(data.solicitado_por).trim() : null,
    observaciones: data.observaciones ? String(data.observaciones).trim() : null
  });

  return {
    status: 'ok',
    message: 'Artículo actualizado correctamente'
  };
}

async function eliminarInventarioABC(id) {
  validarId(id, 'ID de inventario');

  const existente = await inventarioABCModel.obtenerInventarioABCById(id);
  if (!existente || existente.length === 0) {
    const error = new Error('Artículo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  await inventarioABCModel.eliminarInventarioABC(id);

  return {
    status: 'ok',
    message: 'Artículo eliminado correctamente'
  };
}

async function obtenerImagenesInventarioABC(id) {
  validarId(id, 'ID de inventario');
  return await inventarioABCModel.obtenerImagenesPorInventarioId(id);
}

async function subirImagenesInventarioABC(id, files) {
  validarId(id, 'ID de inventario');

  const existente = await inventarioABCModel.obtenerInventarioABCById(id);
  if (!existente || existente.length === 0) {
    const error = new Error('Artículo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (!files || files.length === 0) {
    const error = new Error('Debes subir al menos una imagen');
    error.statusCode = 400;
    throw error;
  }

  const insertados = [];

  for (const file of files) {
    const result = await inventarioABCModel.insertarImagenABC({
      inventario_abc_id: id,
      nombre_archivo: file.filename,
      ruta_archivo: file.path
    });

    insertados.push({
      imagen_id: result.insertId,
      nombre_archivo: file.filename,
      ruta_archivo: file.path
    });
  }

  return {
    status: 'ok',
    imagenes: insertados
  };
}

async function eliminarImagenInventarioABC(imagenId) {
  validarId(imagenId, 'ID de imagen');

  const rows = await inventarioABCModel.obtenerImagenPorId(imagenId);

  if (!rows || rows.length === 0) {
    const error = new Error('Imagen no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const imagen = rows[0];

  if (imagen.ruta_archivo && fs.existsSync(imagen.ruta_archivo)) {
    fs.unlinkSync(imagen.ruta_archivo);
  }

  await inventarioABCModel.eliminarImagenABC(imagenId);

  return {
    status: 'ok',
    message: 'Imagen eliminada correctamente'
  };
}

async function registrarMovimientoInventarioABC(data) {
  const inventarioId = Number(data.inventario_abc_id);
  const cantidad = Number(data.cantidad);
  const tipo = data.tipo_movimiento ? String(data.tipo_movimiento).trim().toLowerCase() : '';

  validarId(inventarioId, 'ID de inventario');

  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
    const error = new Error('Tipo de movimiento inválido');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    const error = new Error('La cantidad debe ser mayor a 0');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioABCModel.obtenerInventarioABCById(inventarioId);

  if (!rows || rows.length === 0) {
    const error = new Error('Artículo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const item = rows[0];
  let nuevaCantidad = Number(item.cantidad);

  if (tipo === 'entrada') {
    nuevaCantidad += cantidad;
  } else if (tipo === 'salida') {
    if (cantidad > nuevaCantidad) {
      const error = new Error('No hay stock suficiente para la salida');
      error.statusCode = 400;
      throw error;
    }
    nuevaCantidad -= cantidad;
  } else if (tipo === 'ajuste') {
    nuevaCantidad = cantidad;
  }

  await inventarioABCModel.insertarMovimientoABC({
    inventario_abc_id: inventarioId,
    tipo_movimiento: tipo,
    cantidad,
    numero_ticket: data.numero_ticket ? String(data.numero_ticket).trim() : null,
    solicitado_por: data.solicitado_por ? String(data.solicitado_por).trim() : null,
    comentario: data.comentario ? String(data.comentario).trim() : null
  });

  await inventarioABCModel.actualizarCantidadInventarioABC(inventarioId, nuevaCantidad);

  return {
    status: 'ok',
    message: 'Movimiento registrado correctamente',
    cantidad_actual: nuevaCantidad
  };
}

async function obtenerMovimientosInventarioABC(id) {
  validarId(id, 'ID de inventario');
  return await inventarioABCModel.obtenerMovimientosPorInventarioId(id);
}

async function obtenerStockPorCategoria(categoriaId) {
  validarId(categoriaId, 'Categoría');

  const rows = await inventarioABCModel.obtenerStockPorCategoriaId(categoriaId);

  if (!rows || rows.length === 0) {
    const error = new Error('Stock de categoría no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function obtenerTodosLosStocksCategoria() {
  return await inventarioABCModel.obtenerTodosLosStocksCategoria();
}

async function actualizarStockCategoria(categoriaId, stockTotal) {
  validarId(categoriaId, 'Categoría');

  if (!Number.isInteger(stockTotal) || stockTotal < 0) {
    const error = new Error('El stock total debe ser un número válido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioABCModel.obtenerStockPorCategoriaId(categoriaId);

  if (!rows || rows.length === 0) {
    const error = new Error('Stock de categoría no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const piezasRegistradas = Number(rows[0].piezas_registradas);

  if (stockTotal < piezasRegistradas) {
    const error = new Error('El stock total no puede ser menor que las piezas ya registradas');
    error.statusCode = 400;
    throw error;
  }

  await inventarioABCModel.actualizarStockTotalCategoria(categoriaId, stockTotal);

  return {
    status: 'ok',
    message: 'Stock total actualizado correctamente'
  };
}

async function registrarPrestamoABC(inventarioId, data) {

  const inventarioRows =
    await inventarioABCModel.obtenerInventarioABCById(inventarioId);

  if (!inventarioRows.length) {
    const error = new Error('Artículo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const item = inventarioRows[0];

  const cantidadSolicitada = Number(data.cantidad || 0);

  if (cantidadSolicitada <= 0) {
    throw new Error('Cantidad inválida');
  }

  if (cantidadSolicitada > Number(item.cantidad)) {
    throw new Error('No hay stock suficiente');
  }

  const ticketBase =
    item.ticket_asignacion || 'ABC';

  const ultimo =
    await inventarioABCModel.obtenerUltimoTicketPrestamo(
      ticketBase
    );

  let consecutivo = 1;

  if (ultimo.length > 0) {

    const ultimoTicket =
      ultimo[0].ticket_prestamo;

    const partes =
      ultimoTicket.split('-');

    const num =
      Number(partes[partes.length-1]);

    if(!isNaN(num)){
      consecutivo = num + 1;
    }
  }

  const ticketPrestamo =
    `${ticketBase}-${String(consecutivo).padStart(3,'0')}`;

  await inventarioABCModel.insertarPrestamoABC({
      inventario_abc_id: inventarioId,
      ticket_prestamo: ticketPrestamo,
      solicitante_nombre: data.solicitante_nombre,
      departamento: data.departamento,
      cantidad: cantidadSolicitada,
      estado_entrega: data.estado_entrega,
      fecha_asignacion: data.fecha_asignacion || new Date(),
      comentario: data.comentario || ''
  });

  await inventarioABCModel.actualizarCantidadInventarioABC(
      inventarioId,
      Number(item.cantidad) - cantidadSolicitada
  );

  return {
    status:'ok',
    ticket_prestamo: ticketPrestamo
  };

}


//historial de prestamos 

async function listarPrestamosABC(inventarioId){

 return await inventarioABCModel
   .obtenerPrestamosPorInventarioId(inventarioId);

}

//DEVOLVER PRESTAMO
async function devolverPrestamoABC(prestamoId,data){

 const rows =
   await inventarioABCModel.obtenerPrestamoPorId(prestamoId);

 if(!rows.length){
   throw new Error('Préstamo no encontrado');
 }

 const prestamo = rows[0];

 if(prestamo.estado_prestamo === 'devuelto'){
   throw new Error('Ya fue devuelto');
 }

 await inventarioABCModel.devolverPrestamoABC(
   prestamoId,
   {
     estado_devolucion:data.estado_devolucion,
     detalle_devolucion:data.detalle_devolucion || '',
     fecha_devolucion:data.fecha_devolucion || new Date()
   }
 );

 const inventario =
   await inventarioABCModel
     .obtenerInventarioABCById(
       prestamo.inventario_abc_id
     );

 const actual =
   Number(inventario[0].cantidad);

 await inventarioABCModel.actualizarCantidadInventarioABC(
    prestamo.inventario_abc_id,
    actual + Number(prestamo.cantidad)
 );

 return {status:'ok'};

}


//resumen mensual o semanal

async function obtenerResumenPrestamos(
  fechaInicio,
  fechaFin
){

 return await inventarioABCModel
   .obtenerResumenPrestamos(
      fechaInicio,
      fechaFin
   );

}



module.exports = {
  listarCategorias,
  listarInventarioABC,
  obtenerInventarioABCById,
  crearInventarioABC,
  actualizarInventarioABC,
  eliminarInventarioABC,
  obtenerImagenesInventarioABC,
  subirImagenesInventarioABC,
  eliminarImagenInventarioABC,
  registrarMovimientoInventarioABC,
  obtenerMovimientosInventarioABC,
  obtenerStockPorCategoria,
  obtenerTodosLosStocksCategoria,
  actualizarStockCategoria,

  registrarPrestamoABC,
  listarPrestamosABC,
  devolverPrestamoABC,
  obtenerResumenPrestamos,
};