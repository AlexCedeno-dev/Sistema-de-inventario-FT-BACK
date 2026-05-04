const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const inventarioService = require('../services/inventario.service');
const inventarioModel = require('../models/inventario.model');
const { permission } = require('process');
const GERENTE_NOMBRE = 'Anibal Cervantes Duran';
const GERENTE_FIRMA_PATH = path.join(__dirname, '../assets/firmas/firma-anibal.png');
const QRCode = require('qrcode');


async function getInventarioNuevo(req, res) {
  try {
    const result = await inventarioService.listarInventarioNuevo();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getInventarioViejo(req, res) {
  try {
    const result = await inventarioService.listarInventarioViejo();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function crearResponsivaPDF({ data, entregadoPor, firmaITBase64, firmaReceptorBase64, output }) {
    const doc = new PDFDocument({
        size: 'LETTER',
        margin: 30 // Margen ligeramente menor para ganar espacio
    });
    doc.pipe(output);

    const logoPath = path.join(__dirname, '../assets/logos/foresight-logo.png');
    const estadoEquipoPath = path.join(__dirname, '../assets/estado-equipo/estado-equipo.png');
    
    const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const fechaAsignacion = data.fecha_asig
        ? new Date(data.fecha_asig).toISOString().split('T')[0]
        : '________________';

    const specsTexto = data.specs
        ? `${data.specs}, Cargador y mochila`
        : `${data.marca || ''} ${data.modelo || ''}, Cargador y mochila`.trim();

    const equipoTexto = `${data.marca || ''} ${data.modelo || ''}`.trim() || 'N/A';

    // --- ENCABEZADO ---
    doc.image(logoPath, 50, 45, { width: 140 }); // Subimos el logo
    
    doc.font('Helvetica-Bold')
        .fontSize(9)
        .text(`Aguascalientes, Ags., ${fechaGeneracion}`, 320, 65, {
            underline: true,
            width: 240,
            align: 'right'
        });

    // Título
    doc.font('Helvetica-Bold')
        .fontSize(12)
        .text('Carta responsiva equipo de computo', 0, 110, { align: 'center' });

    // --- CUERPO DEL TEXTO (ESTILO PÁRRAFO FLUIDO) ---
    doc.fontSize(10).font('Helvetica');
    
    const xInicio = 55;
    const yInicio = 140;
    const lineSpacing = 18; // Espacio entre líneas para que no se amontone

    // Línea 1 y 2
    doc.text('Mediante este documento, el área de sistemas de la empresa Foresight Mexico CO LTD S de RL de CV, hace entrega del equipo marca y modelo ', xInicio, yInicio, { continued: true, width: 500, align: 'justify' });
    doc.font('Helvetica-Bold').text(`${equipoTexto} `, { continued: true });

    doc.font('Helvetica').text('con el numero de serie ', { continued: true });
    doc.font('Helvetica-Bold').text(`${data.service_tag || 'N/A'} `, { continued: true });

    doc.font('Helvetica').text('el cual se entrega a ', { continued: true });

    // Línea 3
    doc.font('Helvetica-Bold').text(`${data.nombre_completo || 'N/A'} `, { continued: true});
    doc.font('Helvetica').text(', del area de: ', { continued: true });
    doc.font('Helvetica-Bold').text(`${data.departamento || 'N/A'} `, { continued: true, });

    // Línea 4
    doc.font('Helvetica').text('quien tendrá uso y responsabilidad sobre el desde: ', { continued: true });
    doc.font('Helvetica-Bold').text(`${fechaAsignacion}.`);

    // Ajustamos la posición Y para lo que sigue (Responsabilidad)
    const ySiguiente = doc.y + 5;
    
    // Responsabilidad
    doc.font('Helvetica')
        .fontSize(9)
        .text(
            'El receptor, asume total responsabilidad y el cuidado de dicho equipo completo y parcial del mismo. Se compromete a utilizarlo con un uso estrictamente laboral. No se podrá instalar programas ajenos al uso de la empresa, hacer modificaciones de cualquier tipo al equipo, contando con las siguientes especificaciones.',
            50,
            235,
            { width: 510, align: 'justify', lineGap: 1 }
        );

    // Especificaciones
    doc.font('Helvetica-Bold')
        .text(`Especificaciones: ${specsTexto}`, 50, 280, { width: 510, align: 'center' });

    // --- IMAGEN ESTADO EQUIPO ---
    doc.image(estadoEquipoPath, 75, 305, {
        width: 460, // Un poco más grande para que se vea bien
        align: 'center'
    });

    // --- CLÁUSULAS (Más juntas) ---
    const yClausulas = 480;
    doc.font('Helvetica-Bold').fontSize(8);
    
    doc.text(
        'NO se permite extraer algún componente de equipo para uso personal o sustraerlo de la planta sin previa autorización de su gerente. Cualquier problema o fallo, deberá ser informado al departamento de IT.',
        50, yClausulas, { width: 510, align: 'center' }
    );

    doc.font('Helvetica').text(
        'En caso de extravío, robo por negligencia (Ejemplo dejar equipo en auto) o robo sin violencia el usuario deberá de cubrir el 100% del valor total del equipo VALOR FACTURA.',
        50, yClausulas + 30, { width: 510, align: 'center' }
    );

    doc.text(
        'En caso de robo con violencia, el usuario deberá presentar la denuncia pertinente ante el MP, se tendrá que mostrar la original y entregar una copia al departamento de IT; en este caso, el usuario solo cubrirá el deducible del valor total del equipo según la póliza vigente del seguro.',
        50, yClausulas + 65, { width: 510, align: 'center' }
    );

    // --- SECCIÓN DE FIRMAS ---
    const yFirmas = 680;

    // Firmas (Imágenes)
    if (fs.existsSync(GERENTE_FIRMA_PATH)) {
        doc.image(GERENTE_FIRMA_PATH, 100, yFirmas - 45, { fit: [120, 40], align: 'center' });
    }
    
    if (firmaReceptorBase64) {
        const base64DataReceptor = firmaReceptorBase64.replace(/^data:image\/png;base64,/, '');
        const firmaReceptorBuffer = Buffer.from(base64DataReceptor, 'base64');
        doc.image(firmaReceptorBuffer, 370, yFirmas - 45, { fit: [120, 40], align: 'center' });
    }

    // Líneas de firma
    doc.moveTo(70, yFirmas).lineTo(250, yFirmas).stroke();
    doc.moveTo(340, yFirmas).lineTo(520, yFirmas).stroke();

    // Textos de firma
    doc.font('Helvetica-Bold').fontSize(9);
    
    doc.text(GERENTE_NOMBRE, 70, yFirmas + 5, { width: 180, align: 'center' });
    doc.text(data.nombre_completo || 'Receptor', 340, yFirmas + 5, { width: 180, align: 'center' });
    
    doc.font('Helvetica').fontSize(8);
    doc.text('Departamento de IT', 70, yFirmas + 18, { width: 180, align: 'center' });
    doc.text('Receptor', 340, yFirmas + 18, { width: 180, align: 'center' });

    doc.end();
    return doc;
}

async function getResponsivaPDF(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const entregadoPor = (req.query.entregadoPor || '').toString().trim();

    if (!entregadoPor) {
      return res.status(400).json({ error: 'Falta el nombre de quien entrega' });
    }

    const data = await inventarioService.obtenerDatosResponsiva(equipoId);
    const fileName = `Responsiva_${data.service_tag || data.equipo_id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    await crearResponsivaPDF({
      data,
      entregadoPor,
      output: res
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}


async function postResponsivaFirmaDigital(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const { firmaITBase64, firmaReceptorBase64, entregadoPor } = req.body;

    if (!firmaITBase64) {
      return res.status(400).json({ error: 'Firma de IT requerida' });
    }

    if (!firmaReceptorBase64) {
      return res.status(400).json({ error: 'Firma del receptor requerida' });
    }

    if (!entregadoPor) {
      return res.status(400).json({ error: 'Falta nombre de quien entrega' });
    }

    const data = await inventarioService.obtenerDatosResponsiva(equipoId);

    const uploadDir = path.join(__dirname, '../uploads/responsivas');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const nombreArchivo = `responsiva_firmada_${equipoId}_${Date.now()}.pdf`;
    const rutaArchivo = path.join(uploadDir, nombreArchivo);

    const stream = fs.createWriteStream(rutaArchivo);

    const doc = await crearResponsivaPDF({
      data,
      entregadoPor,
      firmaITBase64,
      firmaReceptorBase64,
      output: stream
    });

    await new Promise((resolve) => {
      doc.on('end', resolve);
      stream.on('finish', resolve);
    });

    await inventarioService.guardarDocumentoResponsivaDigital({
      equipoId,
      nombreArchivo,
      rutaArchivo
    });

    res.json({
      status: 'ok',
      nombre_archivo: nombreArchivo
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postSubirResponsivaFirmada(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const result = await inventarioService.guardarResponsivaFirmada(equipoId, req.file);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}


async function getResponsivaFirmada(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const rows = await inventarioService.obtenerDocumentoResponsiva(equipoId);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Responsiva no encontrada' });
    }

    const doc = rows[0];
    return res.download(doc.ruta_archivo, doc.nombre_archivo);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postSubirBitlocker(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const result = await inventarioService.guardarBitlocker(equipoId, req.file);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getBitlocker(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const rows = await inventarioService.obtenerDocumentoBitlocker(equipoId);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'BitLocker no encontrado' });
    }

    const doc = rows[0];
    return res.download(doc.ruta_archivo, doc.nombre_archivo);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function postGenerarLinkFirma(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const { entregadoPor, tipoEntregador } = req.body;

    const baseUrl =
      process.env.FRONTEND_URL ||
      req.headers.origin ||
      'http://localhost:5173';

    const frontendPath =
      process.env.FRONTEND_PATH || '';

    const result = await inventarioService.generarLinkFirma({
      equipoId,
      entregadoPor,
      tipoEntregador,
      baseUrl,
      frontendPath
    });

    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}

async function getDatosFirmaToken(req, res) {
  try {
    const { token } = req.params;
    const result = await inventarioService.obtenerDatosFirmaPorToken(token);
    res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}


async function postGuardarFirmaToken(req,res){

 try{

 const { token }=
 req.params;

 const {
  firmaReceptorBase64
 }=req.body;

 if(!firmaReceptorBase64){
   return res.status(400)
   .json({
    error:'Firma requerida'
   });
 }

 const firmaData=
 await inventarioService
 .obtenerDatosFirmaPorToken(
   token
 );

 const data=
 await inventarioService
 .obtenerDatosResponsiva(
   firmaData.equipo_id
 );

 const uploadDir=
 path.join(
  __dirname,
 '../uploads/responsivas'
 );

 if(!fs.existsSync(uploadDir)){
   fs.mkdirSync(
    uploadDir,
   {recursive:true}
   );
 }

 const nombreArchivo=
`responsiva_firmada_${firmaData.equipo_id}_${Date.now()}.pdf`;

 const rutaArchivo=
 path.join(
   uploadDir,
   nombreArchivo
 );

 const stream=
 fs.createWriteStream(
   rutaArchivo
 );

 const doc= await crearResponsivaPDF({
      data,
      entregadoPor:
      firmaData.entregado_por,

      firmaReceptorBase64,
   output:stream
 });

 await new Promise(
  resolve=>{
   doc.on(
    'end',
     resolve
   );

   stream.on(
    'finish',
     resolve
   );
 });

 await inventarioService
 .guardarDocumentoResponsivaDigital({
   equipoId:
   firmaData.equipo_id,

   nombreArchivo,
   rutaArchivo
 });

 await inventarioModel
 .marcarFirmaComoCompletada(
   token
 );

 res.json({
   status:'ok'
 });

 }catch(error){

 const statusCode=
 error.statusCode || 500;

 res.status(statusCode)
 .json({
  error:error.message
 });

 }
 
}


async function getHistorialEntregas(req,res){

    try{

    const filtro =
    req.query.filtro || 'hoy';

    const result=
    await inventarioService
    .obtenerHistorialEntregas(
      filtro
    );

    res.json(result);

    }catch(error){

    res.status(500).json({
      error:error.message
    });

    }

}

async function getEquipoPorQrToken(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        error: 'Token QR requerido'
      });
    }

    const rows = await inventarioModel.obtenerEquipoPorQrToken(token);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'Equipo no encontrado'
      });
    }

    const equipo = rows[0];

    res.json({
      status: 'ok',
      equipo: {
        equipo_id: equipo.equipo_id,
        codigo_activo: `FSMX-${equipo.service_tag}-${equipo.equipo_id}`,
        service_tag: equipo.service_tag,
        empleado_asignado: equipo.empleado_asignado,
        departamento: equipo.departamento,
        tipo: equipo.tipo,
        marca: equipo.marca,
        modelo: equipo.modelo,
        permiso_salida: equipo.permiso_salida,
        estado_registro: equipo.estado_registro,
        fecha_asig: equipo.fecha_asig
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}

async function patchPermisoSalida(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const permisoSalida = req.body.permiso_salida ? 1 : 0;

    await inventarioModel.actualizarPermisoSalida(equipoId, permisoSalida);

    res.json({
      status: 'ok',
      equipo_id: equipoId,
      permiso_salida: permisoSalida
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getEtiquetaQrPDF(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);

    if (!equipoId) {
      return res.status(400).json({ error: 'ID de equipo inválido' });
    }

    const rows = await inventarioModel.obtenerEquipoEtiquetaQR(equipoId);

    if (!rows.length) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const data = rows[0];

    if (!data.qr_token) {
      return res.status(400).json({ error: 'El equipo no tiene QR Token' });
    }

    const baseUrl =
      process.env.FRONTEND_URL ||
      req.headers.origin ||
      'http://localhost:5173';

    const frontendPath =
      process.env.FRONTEND_PATH || '/inventory-it';

    const qrUrl = `${baseUrl}${frontendPath}/validar-equipo/${data.qr_token}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300
    });

    const qrBuffer = Buffer.from(
      qrDataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    );

    const fileName = `Etiqueta_QR_${data.service_tag || data.equipo_id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({
      size: [650, 330],
      margin: 25
    });

    doc.pipe(res);

    doc.rect(10, 10, 630, 310).stroke();

    doc.font('Helvetica-Bold')
      .fontSize(28)
      .text('FORESIGHT', 0, 25, { align: 'center' });

    doc.font('Helvetica-Bold')
      .fontSize(16)
      .text('Foresight Mexico Technology Co., Ltd.', 0, 58, { align: 'center' });

    doc.image(qrBuffer, 40, 95, {
      width: 190,
      height: 190
    });

    const x = 260;
    let y = 95;

    const codigoActivo = `FSMX-${data.service_tag}-${data.equipo_id}`;
    const permisoTexto = data.permiso_salida === 1
      ? 'AUTORIZADO PARA SALIR'
      : 'NO AUTORIZADO PARA SALIR';

    const fechaAsignacion = data.fecha_asig
      ? new Date(data.fecha_asig).toLocaleDateString('es-MX')
      : 'N/A';

    function linea(label, value) {
      doc.font('Helvetica-Bold').fontSize(10).text(label, x, y);
      doc.font('Helvetica').fontSize(13).text(value || 'N/A', x, y + 13);
      doc.moveTo(x, y + 34).lineTo(610, y + 34).stroke();
      y += 40;
    }

    linea('CÓDIGO ACTIVO', codigoActivo);
    linea('EQUIPO', `${data.marca || ''} ${data.modelo || ''}`.trim());
    linea('TIPO', `${data.tipo || ''}`.trim());
    linea('FECHA ASIGNACIÓN', fechaAsignacion);

    doc.end();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getInventarioNuevo,
  getInventarioViejo,
  getResponsivaPDF,
  postResponsivaFirmaDigital,
  postSubirResponsivaFirmada,
  getResponsivaFirmada,
  postSubirBitlocker,
  getBitlocker,
  postGenerarLinkFirma,
  getDatosFirmaToken,
  postGuardarFirmaToken,
  getHistorialEntregas,
  getEquipoPorQrToken,
  patchPermisoSalida,
  getEtiquetaQrPDF,

};