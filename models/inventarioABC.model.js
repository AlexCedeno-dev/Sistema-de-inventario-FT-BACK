const { crearConexion } = require('../configs/db');

async function obtenerCategorias() {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT categoria_id, nombre
      FROM abc_categorias
      WHERE activo = 1
      ORDER BY nombre ASC
    `);
    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerInventarioABC(filtros = {}) {
  const db = await crearConexion();

  try {
    let query = `
      SELECT
        i.inventario_abc_id,
        i.categoria_id,
        c.nombre AS categoria,
        i.cantidad,
        (
          SELECT COALESCE(SUM(p.cantidad), 0)
          FROM abc_prestamos p
          WHERE p.inventario_abc_id = i.inventario_abc_id
            AND p.estado_prestamo = 'prestado'
        ) AS cantidad_prestada,
        i.nombre,
        i.marca,
        i.modelo,
        i.descripcion,
        i.estado_equipo,
        i.ticket_asignacion,
        i.solicitado_por,
        i.observaciones,
        i.created_at,
        i.updated_at,
        (
          SELECT ai.ruta_archivo
          FROM abc_imagenes ai
          WHERE ai.inventario_abc_id = i.inventario_abc_id
          ORDER BY ai.fecha_subida DESC, ai.imagen_id DESC
          LIMIT 1
        ) AS imagen_principal
      FROM abc_inventario i
      INNER JOIN abc_categorias c ON c.categoria_id = i.categoria_id
      WHERE i.activo = 1
    `;

    const params = [];

    if (filtros.categoriaId) {
      query += ` AND i.categoria_id = ? `;
      params.push(filtros.categoriaId);
    }

    if (filtros.busqueda) {
      query += `
        AND (
          i.nombre LIKE ?
          OR i.marca LIKE ?
          OR i.modelo LIKE ?
          OR i.descripcion LIKE ?
        )
      `;
      const like = `%${filtros.busqueda}%`;
      params.push(like, like, like, like);
    }

    query += ` ORDER BY c.nombre ASC, i.nombre ASC `;

    const [rows] = await db.execute(query, params);
    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerInventarioABCById(id) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT
        i.inventario_abc_id,
        i.categoria_id,
        c.nombre AS categoria,
        i.cantidad,
        i.nombre,
        i.marca,
        i.modelo,
        i.descripcion,
        i.estado_equipo,
        i.ticket_asignacion,
        i.solicitado_por,
        i.observaciones,
        i.created_at,
        i.updated_at
      FROM abc_inventario i
      INNER JOIN abc_categorias c ON c.categoria_id = i.categoria_id
      WHERE i.inventario_abc_id = ?
        AND i.activo = 1
      LIMIT 1
    `, [id]);

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarInventarioABC(data) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      INSERT INTO abc_inventario (
        categoria_id,
        cantidad,
        nombre,
        marca,
        modelo,
        descripcion,
        estado_equipo,
        ticket_asignacion,
        solicitado_por,
        observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.categoria_id,
      data.cantidad,
      data.nombre,
      data.marca,
      data.modelo,
      data.descripcion,
      data.estado_equipo,
      data.ticket_asignacion,
      data.solicitado_por,
      data.observaciones
    ]);

    return result;
  } finally {
    await db.end();
  }
}

async function actualizarInventarioABC(id, data) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      UPDATE abc_inventario
      SET
        categoria_id = ?,
        cantidad = ?,
        nombre = ?,
        marca = ?,
        modelo = ?,
        descripcion = ?,
        estado_equipo = ?,
        ticket_asignacion = ?,
        solicitado_por = ?,
        observaciones = ?
      WHERE inventario_abc_id = ?
    `, [
      data.categoria_id,
      data.cantidad,
      data.nombre,
      data.marca,
      data.modelo,
      data.descripcion,
      data.estado_equipo,
      data.ticket_asignacion,
      data.solicitado_por,
      data.observaciones,
      id
    ]);

    return result;
  } finally {
    await db.end();
  }
}

async function eliminarInventarioABC(id) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      UPDATE abc_inventario
      SET activo = 0
      WHERE inventario_abc_id = ?
    `, [id]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerImagenesPorInventarioId(id) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT imagen_id, inventario_abc_id, nombre_archivo, ruta_archivo, fecha_subida
      FROM abc_imagenes
      WHERE inventario_abc_id = ?
      ORDER BY fecha_subida DESC
    `, [id]);

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarImagenABC(data) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      INSERT INTO abc_imagenes (
        inventario_abc_id,
        nombre_archivo,
        ruta_archivo
      ) VALUES (?, ?, ?)
    `, [
      data.inventario_abc_id,
      data.nombre_archivo,
      data.ruta_archivo
    ]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerImagenPorId(imagenId) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT imagen_id, inventario_abc_id, nombre_archivo, ruta_archivo, fecha_subida
      FROM abc_imagenes
      WHERE imagen_id = ?
      LIMIT 1
    `, [imagenId]);

    return rows;
  } finally {
    await db.end();
  }
}

async function eliminarImagenABC(imagenId) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      DELETE FROM abc_imagenes
      WHERE imagen_id = ?
    `, [imagenId]);

    return result;
  } finally {
    await db.end();
  }
}

async function insertarMovimientoABC(data) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      INSERT INTO abc_movimientos (
        inventario_abc_id,
        tipo_movimiento,
        cantidad,
        numero_ticket,
        solicitado_por,
        comentario
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.inventario_abc_id,
      data.tipo_movimiento,
      data.cantidad,
      data.numero_ticket,
      data.solicitado_por,
      data.comentario
    ]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerMovimientosPorInventarioId(id) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT
        movimiento_id,
        inventario_abc_id,
        tipo_movimiento,
        cantidad,
        numero_ticket,
        solicitado_por,
        comentario,
        fecha_movimiento
      FROM abc_movimientos
      WHERE inventario_abc_id = ?
      ORDER BY fecha_movimiento DESC, movimiento_id DESC
    `, [id]);

    return rows;
  } finally {
    await db.end();
  }
}

async function actualizarCantidadInventarioABC(id, cantidad) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      UPDATE abc_inventario
      SET cantidad = ?
      WHERE inventario_abc_id = ?
    `, [cantidad, id]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerStockPorCategoriaId(categoriaId) {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT
        s.stock_categoria_id,
        s.categoria_id,
        c.nombre AS categoria,
        s.stock_total,
        COALESCE(SUM(i.cantidad), 0) AS piezas_registradas,
        (s.stock_total - COALESCE(SUM(i.cantidad), 0)) AS stock_disponible
      FROM abc_stock_categoria s
      INNER JOIN abc_categorias c
        ON c.categoria_id = s.categoria_id
      LEFT JOIN abc_inventario i
        ON i.categoria_id = s.categoria_id
       AND i.activo = 1
      WHERE s.categoria_id = ?
      GROUP BY
        s.stock_categoria_id,
        s.categoria_id,
        c.nombre,
        s.stock_total
      LIMIT 1
    `, [categoriaId]);

    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerTodosLosStocksCategoria() {
  const db = await crearConexion();
  try {
    const [rows] = await db.execute(`
      SELECT
        s.stock_categoria_id,
        s.categoria_id,
        c.nombre AS categoria,
        s.stock_total,
        COALESCE(SUM(i.cantidad), 0) AS piezas_registradas,
        (s.stock_total - COALESCE(SUM(i.cantidad), 0)) AS stock_disponible
      FROM abc_stock_categoria s
      INNER JOIN abc_categorias c
        ON c.categoria_id = s.categoria_id
      LEFT JOIN abc_inventario i
        ON i.categoria_id = s.categoria_id
       AND i.activo = 1
      GROUP BY
        s.stock_categoria_id,
        s.categoria_id,
        c.nombre,
        s.stock_total
      ORDER BY c.nombre ASC
    `);

    return rows;
  } finally {
    await db.end();
  }
}

async function actualizarStockTotalCategoria(categoriaId, stockTotal) {
  const db = await crearConexion();
  try {
    const [result] = await db.execute(`
      UPDATE abc_stock_categoria
      SET stock_total = ?
      WHERE categoria_id = ?
    `, [stockTotal, categoriaId]);

    return result;
  } finally {
    await db.end();
  }
}

  async function buscarArticuloDuplicado(data) {
    const db = await crearConexion();

    try {
      const [rows] = await db.execute(`
        SELECT inventario_abc_id
        FROM abc_inventario
        WHERE categoria_id = ?
          AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(modelo, ''))) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(descripcion, ''))) = LOWER(TRIM(?))
          AND LOWER(TRIM(COALESCE(estado_equipo, ''))) = LOWER(TRIM(?))
          AND activo = 1
        LIMIT 1
      `, [
        data.categoria_id,
        data.nombre,
        data.modelo || '',
        data.descripcion || '',
        data.estado_equipo || ''
      ]);

      return rows;
    } finally {
      await db.end();
    }
  }

async function obtenerUltimoTicketPrestamo(ticketBase) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT ticket_prestamo
      FROM abc_prestamos
      WHERE ticket_prestamo LIKE ?
      ORDER BY prestamo_id DESC
      LIMIT 1
    `, [`${ticketBase}-%`]);

    return rows;
  } finally {
    await db.end();
  }
}

async function insertarPrestamoABC(data) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(`
      INSERT INTO abc_prestamos (
        inventario_abc_id,
        ticket_prestamo,
        solicitante_nombre,
        departamento,
        cantidad,
        estado_entrega,
        fecha_asignacion,
        comentario
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.inventario_abc_id,
      data.ticket_prestamo,
      data.solicitante_nombre,
      data.departamento,
      data.cantidad,
      data.estado_entrega,
      data.fecha_asignacion,
      data.comentario
    ]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerPrestamosPorInventarioId(inventarioId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT *
      FROM abc_prestamos
      WHERE inventario_abc_id = ?
      ORDER BY fecha_asignacion DESC, prestamo_id DESC
    `, [inventarioId]);

    return rows;
  } finally {
    await db.end();
  }
}

async function obtenerPrestamoPorId(prestamoId) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT *
      FROM abc_prestamos
      WHERE prestamo_id = ?
      LIMIT 1
    `, [prestamoId]);

    return rows;
  } finally {
    await db.end();
  }
}

async function devolverPrestamoABC(prestamoId, data) {
  const db = await crearConexion();

  try {
    const [result] = await db.execute(`
      UPDATE abc_prestamos
      SET
        estado_prestamo = 'devuelto',
        estado_devolucion = ?,
        detalle_devolucion = ?,
        fecha_devolucion = ?
      WHERE prestamo_id = ?
        AND estado_prestamo = 'prestado'
    `, [
      data.estado_devolucion,
      data.detalle_devolucion,
      data.fecha_devolucion,
      prestamoId
    ]);

    return result;
  } finally {
    await db.end();
  }
}

async function obtenerResumenPrestamos(fechaInicio, fechaFin) {
  const db = await crearConexion();

  try {
    const [rows] = await db.execute(`
      SELECT
        p.prestamo_id,
        p.ticket_prestamo,
        p.solicitante_nombre,
        p.departamento,
        p.cantidad,
        p.estado_entrega,
        p.fecha_asignacion,
        p.estado_prestamo,
        p.estado_devolucion,
        p.detalle_devolucion,
        p.fecha_devolucion,
        i.nombre,
        i.modelo,
        i.ticket_asignacion,
        c.nombre AS categoria
      FROM abc_prestamos p
      INNER JOIN abc_inventario i
        ON i.inventario_abc_id = p.inventario_abc_id
      INNER JOIN abc_categorias c
        ON c.categoria_id = i.categoria_id
      WHERE p.fecha_asignacion BETWEEN ? AND ?
      ORDER BY p.fecha_asignacion DESC
    `, [fechaInicio, fechaFin]);

    return rows;
  } finally {
    await db.end();
  }
}


module.exports = {
  obtenerCategorias,
  obtenerInventarioABC,
  obtenerInventarioABCById,
  insertarInventarioABC,
  actualizarInventarioABC,
  eliminarInventarioABC,
  obtenerImagenesPorInventarioId,
  insertarImagenABC,
  obtenerImagenPorId,
  eliminarImagenABC,
  insertarMovimientoABC,
  obtenerMovimientosPorInventarioId,
  actualizarCantidadInventarioABC,
  obtenerStockPorCategoriaId,
  obtenerTodosLosStocksCategoria,
  actualizarStockTotalCategoria,
  buscarArticuloDuplicado,

  obtenerUltimoTicketPrestamo,
  insertarPrestamoABC,
  obtenerPrestamosPorInventarioId,
  obtenerPrestamoPorId,
  devolverPrestamoABC,
  obtenerResumenPrestamos,

};