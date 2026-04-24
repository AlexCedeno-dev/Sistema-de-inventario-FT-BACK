const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const inventarioService = require('../services/inventario.service');
const inventarioModel = require('../models/inventario.model');


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

async function crearResponsivaPDF({ data,entregadoPor,firmaITBase64,firmaReceptorBase64,output}) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 35
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
    ? `${data.specs}, cargador y mochila`
    : `${data.marca || ''} ${data.modelo || ''}, cargador y mochila`.trim();

  doc.font('Helvetica-Bold')
    .fontSize(13)
    .text('RESPONSIVA DE EQUIPO COMPUTO', 0, 18, { align: 'center' });

  doc.image(logoPath, 55, 70, { width: 170 });

  doc.font('Helvetica')
    .fontSize(10.5)
    .text(`Aguascalientes, Ags., ${fechaGeneracion}`, 355, 95, {
      underline: true,
      width: 190,
      align: 'left'
    });

  doc.font('Helvetica-Bold')
    .fontSize(14)
    .text('Carta responsiva equipo de computo', 0, 160, { align: 'center' });

  doc.font('Helvetica')
    .fontSize(10.5)
    .text(
      'Mediante este documento, el área de sistemas de la empresa Foresight Mexico CO LTD S de RL de CV, hace entrega del equipo marca y modelo',
      55,
      205,
      { width: 370 }
    );

  doc.font('Helvetica-Bold')
    .text(`${data.marca || ''} ${data.modelo || ''}`.trim() || 'N/A', 415, 222, {
      underline: true,
      width: 120,
      align: 'center'
    });

  doc.font('Helvetica').text('con el numero de serie', 55, 252);

  doc.font('Helvetica-Bold')
    .text(`${data.service_tag || 'N/A'}`, 165, 252, {
      underline: true,
      width: 95,
      align: 'center'
    });

  doc.font('Helvetica').text('el cual se entrega a', 360, 252);

  doc.font('Helvetica-Bold')
    .text(`${data.nombre_completo || 'N/A'}`, 55, 280, {
      underline: true,
      width: 250,
      align: 'center'
    });

  doc.font('Helvetica').text(', del area de:', 315, 280);

  doc.font('Helvetica-Bold')
    .text(`${data.departamento || 'N/A'}`, 420, 280, {
      underline: true,
      width: 110,
      align: 'center'
    });

  doc.font('Helvetica').text('quien tendra uso y responsabilidad sobre el desde:', 55, 308);

  doc.font('Helvetica-Bold')
    .text(`${fechaAsignacion}`, 365, 308, {
      underline: true,
      width: 130,
      align: 'center'
    });

  doc.font('Helvetica')
    .fontSize(10)
    .text(
      'El receptor, asume total responsabilidad y el cuidado de dicho equipo completo y parcial del mismo. Se compromete a utilizarlo con un uso estrictamente laboral. No se podrá instalar programas ajenos al uso de la empresa, hacer modificaciones de cualquier tipo al equipo, contando con las siguientes especificaciones.',
      55,
      350,
      { width: 500, align: 'justify' }
    );

  doc.font('Helvetica-Bold')
    .fontSize(10)
    .text(`Especificaciones: ${specsTexto}`, 55, 420, {
      width: 500,
      align: 'center'
    });

  doc.image(estadoEquipoPath, 75, 445, {
    fit: [460, 110],
    align: 'center',
    valign: 'center'
  });

  doc.font('Helvetica')
    .fontSize(8.7)
    .text(
      'NO se permite extraer algún componente de equipo para uso personal o sustraerlo de la planta sin previa autorización de su gerente. Cualquier problema o fallo, deberá ser informado al departamento de IT.',
      55,
      565,
      { width: 500, align: 'center' }
    );

  doc.text(
    'En caso de extravío, robo por negligencia (Ejemplo dejar equipo en auto) o robo sin violencia el usuario deberá de cubrir el 100% del valor total del equipo VALOR FACTURA.',
    55,
    600,
    { width: 500, align: 'center' }
  );

  doc.text(
    'En caso de robo con violencia, el usuario deberá presentar la denuncia pertinente ante el MP, se tendrá que mostrar la original y entregar una copia al departamento de IT; en este caso, el usuario solo cubrirá el deducible del valor total del equipo según la póliza vigente del seguro.',
    55,
    635,
    { width: 500, align: 'center' }
  );

  const yFirmas = 715;

  if (firmaITBase64) {
    const base64DataIT = firmaITBase64.replace(/^data:image\/png;base64,/, '');
    const firmaITBuffer = Buffer.from(base64DataIT, 'base64');

    doc.image(firmaITBuffer, 105, yFirmas - 55, {
      fit: [120, 45],
      align: 'center'
    });
  }

  if (firmaReceptorBase64) {
    const base64DataReceptor = firmaReceptorBase64.replace(/^data:image\/png;base64,/, '');
    const firmaReceptorBuffer = Buffer.from(base64DataReceptor, 'base64');

    doc.image(firmaReceptorBuffer, 375, yFirmas - 55, {
      fit: [120, 45],
      align: 'center'
    });
  }

  doc.moveTo(90, yFirmas).lineTo(240, yFirmas).stroke();
  doc.moveTo(350, yFirmas).lineTo(520, yFirmas).stroke();

  doc.font('Helvetica-Bold')
    .fontSize(10)
    .text(entregadoPor || 'Departamento IT', 90, yFirmas + 8, {
      width: 150,
      align: 'center'
    });

  doc.text(`${data.nombre_completo || 'Receptor'}`, 350, yFirmas + 8, {
    width: 170,
    align: 'center'
  });

  doc.text('Departamento de IT', 90, yFirmas + 22, {
    width: 150,
    align: 'center'
  });

  doc.text('Receptor', 350, yFirmas + 22, {
    width: 170,
    align: 'center'
  });

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
    const { entregadoPor } = req.body;

    const baseUrl =
      process.env.FRONTEND_URL ||
      req.headers.origin ||
      'http://localhost:5173';

    const result = await inventarioService.generarLinkFirma({
      equipoId,
      entregadoPor,
      baseUrl
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

 const doc=
 await crearResponsivaPDF({
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
  postGuardarFirmaToken

};