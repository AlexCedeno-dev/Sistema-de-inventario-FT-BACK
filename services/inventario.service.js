const inventarioModel = require('../models/inventario.model');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

async function guardarBitlocker(equipoId, file) {
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
    tipoDocumento: 'BITLOCKER',
    nombreArchivo: file.filename,
    rutaArchivo: file.path
  });

  return {
    status: 'ok',
    documento_id: result.insertId,
    nombre_archivo: file.filename
  };
}

async function obtenerDocumentoBitlocker(equipoId) {
  if (!Number.isInteger(equipoId) || equipoId <= 0) {
    const error = new Error('ID de equipo inválido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioModel.obtenerDocumentoBitlockerPorEquipoId(equipoId);

  if (!rows || rows.length === 0) {
    const error = new Error('BitLocker no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return rows;
}
async function generarResponsivaConFirmaDigital({
 equipoId,
 firmaBase64,
 entregadoPor
}) {

 const datos =
 await inventarioModel.obtenerDatosResponsivaPorEquipoId(
   equipoId
 );

 if(!datos.length){
   throw new Error('Equipo no encontrado');
 }

 const equipo = datos[0];

 const carpeta =
 path.join(__dirname,'../uploads/responsivas');

 if(!fs.existsSync(carpeta)){
   fs.mkdirSync(carpeta,{recursive:true});
 }

 const nombreArchivo =
 `responsiva_firmada_${equipoId}.pdf`;

 const rutaArchivo=
 path.join(
   carpeta,
   nombreArchivo
 );

 const doc =
 new PDFDocument({
   margin:50
 });

 doc.pipe(
   fs.createWriteStream(
     rutaArchivo
   )
 );

 doc.fontSize(18)
 .text(
   'RESPONSIVA DE EQUIPO COMPUTO',
   {align:'center'}
 );

 doc.moveDown(2);

 doc.fontSize(11)
 .text(
`Se entrega el equipo ${equipo.modelo}
con serie ${equipo.service_tag}
a ${equipo.nombre_completo}
departamento ${equipo.departamento}`
 );

 doc.moveDown(4);

 doc.text(
 'Firma receptor:',
 100,
 550
 );

 // Firma canvas
 const base64Data =
 firmaBase64.replace(
   /^data:image\/png;base64,/,
   ''
 );

 const firmaBuffer=
 Buffer.from(
   base64Data,
   'base64'
 );

 doc.image(
   firmaBuffer,
   180,
   520,
   {width:180}
 );

 doc.moveDown(8);

 doc.text(
   '_______________________',
   80,
   680
 );

 doc.text(
   entregadoPor || 'IT',
   100,
   700
 );

 doc.end();

 await new Promise(
  resolve =>
   doc.on(
    'finish',
    resolve
   )
 );

 await inventarioModel.insertarDocumentoEquipo({
   equipoId,
   tipoDocumento:'RESPONSIVA_FIRMADA',
   nombreArchivo,
   rutaArchivo
 });

 return true;
}

async function guardarDocumentoResponsivaDigital({ equipoId, nombreArchivo, rutaArchivo }) {
  if (!Number.isInteger(Number(equipoId)) || Number(equipoId) <= 0) {
    const error = new Error('ID de equipo inválido');
    error.statusCode = 400;
    throw error;
  }

  const result = await inventarioModel.insertarDocumentoEquipo({
    equipoId,
    tipoDocumento: 'RESPONSIVA_FIRMADA',
    nombreArchivo,
    rutaArchivo
  });

  return {
    status: 'ok',
    documento_id: result.insertId,
    nombre_archivo: nombreArchivo
  };
}

async function generarLinkFirma({ equipoId, entregadoPor, tipoEntregador, baseUrl }) {
  const id = Number(equipoId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('ID de equipo inválido');
    error.statusCode = 400;
    throw error;
  }

  if (!entregadoPor || !entregadoPor.trim()) {
    const error = new Error('Falta nombre de quien entrega');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioModel.obtenerDatosResponsivaPorEquipoId(id);

  if (!rows || rows.length === 0) {
    const error = new Error('Equipo no encontrado');
    error.statusCode = 404;
    throw error;
  }

    const responsivaExistente =
    await inventarioModel.obtenerDocumentoResponsivaPorEquipoId(id);

    if (responsivaExistente?.length > 0) {
    const error = new Error(
      'Ya existe una responsiva firmada para este equipo'
    );
    error.statusCode = 409;
    throw error;
    }

  const token = crypto.randomBytes(32).toString('hex');

    await inventarioModel.insertarFirmaPendiente({
      equipoId: id,
      token,
      entregadoPor: entregadoPor.trim(),
      tipoEntregador: tipoEntregador || 'IT'
    });

  return {
    status: 'ok',
    token,
    url: `${baseUrl}/firma/${token}`
  };
}

async function obtenerDatosFirmaPorToken(token) {
  if (!token) {
    const error = new Error('Token requerido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await inventarioModel.obtenerFirmaPendientePorToken(token);

  if (!rows || rows.length === 0) {
    const error = new Error('Firma no encontrada');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function obtenerHistorialEntregas(filtro){
 return await inventarioModel
 .obtenerHistorialEntregas(filtro);
}

module.exports = {
  listarInventarioNuevo,
  listarInventarioViejo,
  obtenerDatosResponsiva,
  guardarResponsivaFirmada,
  generarResponsivaConFirmaDigital,
  obtenerDocumentoResponsiva,
  guardarDocumentoResponsivaDigital,

  guardarBitlocker,
  obtenerDocumentoBitlocker,
  generarLinkFirma,
  obtenerDatosFirmaPorToken,

  obtenerHistorialEntregas
};