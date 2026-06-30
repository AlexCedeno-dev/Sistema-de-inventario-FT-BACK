const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const inventarioService = require('../services/inventario.service');
const inventarioModel = require('../models/inventario.model');
const { permission } = require('process');
const { registrarAuditoriaEquipo } = require('../models/auditoria.model');
const { normalizeRol } = require('../middlewares/auth.middleware');
const GERENTE_NOMBRE = 'Anibal Cervantes Duran';
const GERENTE_FIRMA_PATH = path.join(__dirname, '../assets/firmas/firma-anibal.png');
const QRCode = require('qrcode');

function mmToPt(mm) {
  return mm * 2.83465;
}


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

async function crearResponsivaPDF({ data, entregadoPor, firmaITBase64, firmaReceptorBase64, firmaGerenteBase64 = null, esBecarioPreview = false, output }) {
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

    if (firmaGerenteBase64 || esBecarioPreview) {
        // Layout 3 columnas: IT | Empleado | Gerente
        if (fs.existsSync(GERENTE_FIRMA_PATH)) {
            doc.image(GERENTE_FIRMA_PATH, 50, yFirmas - 45, { fit: [110, 40], align: 'center' });
        }
        if (firmaReceptorBase64) {
            const base64DataReceptor = firmaReceptorBase64.replace(/^data:image\/png;base64,/, '');
            const firmaReceptorBuffer = Buffer.from(base64DataReceptor, 'base64');
            doc.image(firmaReceptorBuffer, 220, yFirmas - 45, { fit: [110, 40], align: 'center' });
        }
        if (firmaGerenteBase64) {
            const base64DataGerente = firmaGerenteBase64.replace(/^data:image\/png;base64,/, '');
            const firmaGerenteBuffer = Buffer.from(base64DataGerente, 'base64');
            doc.image(firmaGerenteBuffer, 395, yFirmas - 45, { fit: [110, 40], align: 'center' });
        }

        doc.moveTo(45,  yFirmas).lineTo(175, yFirmas).stroke();
        doc.moveTo(215, yFirmas).lineTo(345, yFirmas).stroke();
        doc.moveTo(385, yFirmas).lineTo(515, yFirmas).stroke();

        doc.font('Helvetica-Bold').fontSize(8);
        doc.text(GERENTE_NOMBRE,                       45,  yFirmas + 5, { width: 130, align: 'center' });
        doc.text(data.nombre_completo || 'Empleado',  215, yFirmas + 5, { width: 130, align: 'center' });
        doc.text(data.nombre_gerente  || 'Gerente',   385, yFirmas + 5, { width: 130, align: 'center' });

        doc.font('Helvetica').fontSize(7.5);
        doc.text('Departamento de IT',              45,  yFirmas + 18, { width: 130, align: 'center' });
        doc.text('Firma del Empleado',              215, yFirmas + 18, { width: 130, align: 'center' });
        doc.text('Firma del Gerente / Encargado',  385, yFirmas + 18, { width: 130, align: 'center' });
    } else {
        // Layout 2 columnas (comportamiento actual)
        if (fs.existsSync(GERENTE_FIRMA_PATH)) {
            doc.image(GERENTE_FIRMA_PATH, 100, yFirmas - 45, { fit: [120, 40], align: 'center' });
        }
        if (firmaReceptorBase64) {
            const base64DataReceptor = firmaReceptorBase64.replace(/^data:image\/png;base64,/, '');
            const firmaReceptorBuffer = Buffer.from(base64DataReceptor, 'base64');
            doc.image(firmaReceptorBuffer, 370, yFirmas - 45, { fit: [120, 40], align: 'center' });
        }

        doc.moveTo(70, yFirmas).lineTo(250, yFirmas).stroke();
        doc.moveTo(340, yFirmas).lineTo(520, yFirmas).stroke();

        doc.font('Helvetica-Bold').fontSize(9);
        doc.text(GERENTE_NOMBRE, 70, yFirmas + 5, { width: 180, align: 'center' });
        doc.text(data.nombre_completo || 'Receptor', 340, yFirmas + 5, { width: 180, align: 'center' });

        doc.font('Helvetica').fontSize(8);
        doc.text('Departamento de IT', 70, yFirmas + 18, { width: 180, align: 'center' });
        doc.text('Receptor', 340, yFirmas + 18, { width: 180, align: 'center' });
    }

    doc.end();
    return doc;
}

async function getResponsivaPDF(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);

    // Fuente principal: usuario autenticado. Fallback temporal: query param (compatibilidad frontend)
    const entregadoPor = (
      req.user?.nombre_completo ||
      (req.query.entregadoPor || '').toString().trim()
    );

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
    // Nota: getResponsivaPDF es solo preview del PDF — no llama insertarFirmaPendiente
    // La auditoría ENTREGA se registra en postGenerarLinkFirma y postResponsivaFirmaDigital
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
}


async function postResponsivaFirmaDigital(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const { firmaITBase64, firmaReceptorBase64 } = req.body;

    // Fuente principal: usuario autenticado. Fallback temporal: body (compatibilidad frontend)
    const entregadoPor =
      req.user?.nombre_completo ||
      req.body.entregadoPor ||
      '';

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

    // Auditoría ENTREGA — fire-and-forget
    registrarAuditoriaEquipo({
      equipoId,
      serviceTag: data.service_tag || null,
      accion:     'ENTREGA',
      realizadoPor: req.user,
      descripcion: `Responsiva con firma digital generada por ${entregadoPor}`,
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

    // Fuente principal: usuario autenticado. Fallback temporal: body (compatibilidad frontend)
    const entregadoPor =
      req.user?.nombre_completo ||
      req.body.entregadoPor ||
      '';

    const tipoEntregador =
      (req.user ? normalizeRol(req.user.tipo_usuario) : null) ||
      req.body.tipoEntregador ||
      'IT';

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

    // Auditoría ENTREGA — fire-and-forget
    registrarAuditoriaEquipo({
      equipoId,
      serviceTag: req.body.serviceTag || req.body.service_tag || null,
      accion:     'ENTREGA',
      realizadoPor: req.user,
      descripcion: `Link de firma generado por ${req.user?.nombre_completo || entregadoPor}`,
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


async function getPreviewFirmaToken(req,res){

 try{

  const { token }=req.params;

  const firmaData=
  await inventarioService
  .obtenerDatosFirmaPorToken(token);

  const data=
  await inventarioService
  .obtenerDatosResponsiva(
    firmaData.equipo_id
  );

  res.setHeader('Content-Type','application/pdf');
  res.setHeader(
   'Content-Disposition',
   'inline; filename="preview.pdf"'
  );

  try {
    await crearResponsivaPDF({
      data,
      entregadoPor:firmaData.entregado_por,
      firmaReceptorBase64:null,
      esBecarioPreview: firmaData.tipo_empleado === 'becario',
      output:res
    });
  } catch(err) {
    console.error('Error generando preview PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error generando preview' });
    }
  }

 }catch(error){

  const statusCode=error.statusCode||500;
  res.status(statusCode)
  .json({error:error.message});

 }

}

async function postGuardarFirmaToken(req,res){

 try{

 const { token }=
 req.params;

 const { firmaReceptorBase64, firmaGerenteBase64 } = req.body;

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

 if(firmaData.estado==='ENTREGADO'){
   return res.status(409)
   .json({
    error:'Esta firma ya fue completada anteriormente'
   });
 }

 if (firmaData.tipo_empleado === 'becario' && !firmaGerenteBase64) {
   return res.status(400).json({
     ok: false,
     mensaje: 'Se requiere la firma del gerente para empleados becarios.'
   });
 }

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

 const doc = await crearResponsivaPDF({
   data,
   entregadoPor: firmaData.entregado_por,
   firmaReceptorBase64,
   firmaGerenteBase64,
   output: stream
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

async function getHistorialLiberaciones(req, res) {
  try {
    const filtro = req.query.filtro || 'hoy';

    const result = await inventarioService.obtenerHistorialLiberaciones(filtro);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}

async function getHistorialAltas(req, res) {
  try {
    const filtro = req.query.filtro || 'hoy';
    const result = await inventarioModel.obtenerHistorialAltas(filtro);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

  async function getDetalleHistorialLiberacion(req, res) {
    try {
      const historialLiberacionId = Number(req.params.historialLiberacionId);

      const result =
        await inventarioService.obtenerDetalleHistorialLiberacion(
          historialLiberacionId
        );

      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        error: error.message
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
        fecha_alta_equipo: equipo.fecha_alta_equipo,
        es_ols: equipo.estacion_id !== null,
        tipo_activo: equipo.estacion_id !== null ? 'OLS' : 'EQUIPO',
        estacion_id: equipo.estacion_id ?? null,
        nombre_estacion: equipo.nombre_estacion ?? null,
        tipo_estacion: equipo.tipo_estacion ?? null,
        planta: equipo.planta ?? null,
        linea: equipo.linea ?? null,
        turno: equipo.turno ?? null,
        estado_estacion: equipo.estado_estacion ?? null,
        fecha_alta_estacion: equipo.fecha_alta_estacion ?? null
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
      margin: 1,
      width: 420
    });

    const qrBuffer = Buffer.from(
      qrDataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    );

    const fileName = `Etiqueta_QR_${data.service_tag || data.equipo_id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Medida real de etiqueta: 102 mm x 76 mm
    const labelWidth = mmToPt(102);
    const labelHeight = mmToPt(76);

    const doc = new PDFDocument({
      size: [labelWidth, labelHeight],
      margin: 0
    });

    doc.pipe(res);

    const logoPath = path.join(__dirname, '../assets/logos/foresight-logo.png');

    // Fondo blanco
    doc.rect(0, 0, labelWidth, labelHeight)
      .fill('#FFFFFF');

    doc.fillColor('#000000');

    // // Borde guía suave
    // doc.lineWidth(0.5)
    //   .rect(mmToPt(1.5), mmToPt(1.5), labelWidth - mmToPt(3), labelHeight - mmToPt(3))
    //   .stroke();

    // Logo centrado arriba
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, mmToPt(32), mmToPt(3.5), {
        fit: [mmToPt(38), mmToPt(15)],
        align: 'center',
        valign: 'center'
      });
    } else {
      doc.font('Helvetica-Bold')
        .fontSize(20)
        .text('FORESIGHT', 0, mmToPt(5), {
          width: labelWidth,
          align: 'center'
        });
    }

    // Nombre empresa
    doc.font('Helvetica-Bold')
      .fontSize(10)
      .text('Foresight Mexico Technology Co., Ltd.', 0, mmToPt(17), {
        width: labelWidth,
        align: 'center'
      });

    // QR lado izquierdo
    const qrX = mmToPt(5);
    const qrY = mmToPt(25);
    const qrSize = mmToPt(45);

    doc.image(qrBuffer, qrX, qrY, {
      width: qrSize,
      height: qrSize
    });

    // Línea separadora vertical
    const separatorX = mmToPt(52);
    doc.lineWidth(1)
      .moveTo(separatorX, mmToPt(24))
      .lineTo(separatorX, mmToPt(70))
      .stroke();

    // Datos lado derecho
    const x = mmToPt(55);
    const rightWidth = mmToPt(43);
    let y = mmToPt(25);

    const codigoActivo = `FSMX-${data.service_tag || 'SIN-ST'}-${data.equipo_id}`;

    const fechaAltaEquipo = data.fecha_alta_equipo
      ? new Date(data.fecha_alta_equipo).toLocaleDateString('es-MX')
      : 'N/A';

    const modeloTexto = `${data.marca || ''} ${data.modelo || ''}`.trim() || 'N/A';

    function campo(label, value, options = {}) {
      const labelSize = options.labelSize || 6.5;
      const valueSize = options.valueSize || 8.8;
      const espacio = options.espacio || mmToPt(11);

      doc.font('Helvetica-Bold')
        .fontSize(labelSize)
        .fillColor('#000000')
        .text(label, x, y, {
          width: rightWidth,
          height: mmToPt(4),
          ellipsis: true
        });

      doc.font('Helvetica')
        .fontSize(valueSize)
        .fillColor('#000000')
        .text(value || 'N/A', x, y + mmToPt(4), {
          width: rightWidth,
          height: mmToPt(6),
          ellipsis: true
        });

      y += espacio;

      doc.lineWidth(0.4)
        .strokeColor('#000000')
        .moveTo(x, y - mmToPt(1.5))
        .lineTo(x + rightWidth, y - mmToPt(1.5))
        .stroke();

      doc.strokeColor('#000000');
    }

    campo('CÓDIGO ACTIVO', codigoActivo, {
      valueSize: 8.8,
      espacio: mmToPt(11)
    });

    campo('TIPO', data.tipo || 'N/A', {
      valueSize: 8.8,
      espacio: mmToPt(11)
    });

    campo('EQUIPO', modeloTexto, {
      valueSize: 8.8,
      espacio: mmToPt(11)
    });

    campo('FECHA ALTA EQUIPO', fechaAltaEquipo, {
      valueSize: 8.3,
      espacio: mmToPt(10)
    });

    doc.end();

  } catch (error) {
    console.error('Error generando etiqueta QR:', error);
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
  getPreviewFirmaToken,
  postGuardarFirmaToken,
  getHistorialEntregas,
  getHistorialLiberaciones,
  getHistorialAltas,
  getDetalleHistorialLiberacion,
  getEquipoPorQrToken,
  patchPermisoSalida,
  getEtiquetaQrPDF,
};