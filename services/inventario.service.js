const inventarioModel = require('../models/inventario.model');

async function listarInventarioNuevo() {
  return await inventarioModel.obtenerInventarioNuevo();
}

async function listarInventarioViejo() {
  const rows = await inventarioModel.obtenerInventarioViejo();

  return rows.map((row) => ({
    id: `${row.equipo_id ?? 'null'}-${row.empleado_id ?? 'null'}`,
    idEquipo: row.equipo_id ? String(row.equipo_id) : null,
    idEmpleado: row.empleado_id ? String(row.empleado_id) : null,
    status: row.status ?? null,
    nombreEmpleado: row.nombre_completo ?? null,
    departamento: row.departamento ?? null,
    planta: row.planta ?? null,
    tipo: row.tipo ?? null,
    marca: row.marca ?? null,
    modelo: row.modelo ?? null,
    hostname: row.nombre_equipo ?? null,
    serviceTag: row.service_tag ?? null,
    firmado: !!row.carta_responsiva,
    bitlocker: null,
    cartaResponsiva: row.carta_responsiva ?? null,
    rutaCartaResponsiva: row.ruta_carta_responsiva ?? null,
    finGarantia: row.end_warranty ?? null,
  }));
}

async function obtenerDatosResponsiva(equipoId) {
  if (!Number.isInteger(equipoId) || equipoId <= 0) {
    const error = new Error('ID de equipo inválido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioModel.obtenerDatosResponsivaPorEquipoId(equipoId);

  if (rows.length === 0) {
    const error = new Error('Equipo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function guardarResponsivaFirmada(equipoId, file) {
  if (!Number.isInteger(equipoId) || equipoId <= 0) {
    const error = new Error('ID de equipo inválido');
    error.statusCode = 400;
    throw error;
  }

  if (!file) {
    const error = new Error('Archivo requerido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioModel.obtenerDatosResponsivaPorEquipoId(equipoId);

  if (!rows || rows.length === 0) {
    const error = new Error('Equipo no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const result = await inventarioModel.insertarDocumentoEquipo({
    equipoId,
    tipoDocumento: 'RESPONSIVA_FIRMADA',
    nombreArchivo: file.filename,
    rutaArchivo: file.path
  });

  return {
    status: 'ok',
    documento_id: result.insertId,
    nombre_archivo: file.filename
  };
}

async function obtenerDocumentoResponsiva(equipoId) {
  if (!Number.isInteger(equipoId) || equipoId <= 0) {
    const error = new Error('ID de equipo inválido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioModel.obtenerDocumentoResponsivaPorEquipoId(equipoId);

  if (!rows || rows.length === 0) {
    const error = new Error('Responsiva no encontrada');
    error.statusCode = 404;
    throw error;
  }

  return rows;
}
module.exports = {
  listarInventarioNuevo,
  listarInventarioViejo,
  obtenerDatosResponsiva,
  guardarResponsivaFirmada,
  obtenerDocumentoResponsiva
};