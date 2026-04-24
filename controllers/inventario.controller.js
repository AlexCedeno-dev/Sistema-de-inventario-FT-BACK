const PDFDocument = require('pdfkit');
const path = require('path');
const inventarioService = require('../services/inventario.service');


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

async function getResponsivaPDF(req, res) {
  try {
    const equipoId = Number(req.params.equipoId);
    const entregadoPor = (req.query.entregadoPor || '').toString().trim();

    if (!entregadoPor) {
      return res.status(400).json({ error: 'Falta el nombre de quien entrega' });
    }

    const data = await inventarioService.obtenerDatosResponsiva(equipoId);

    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 35
    });

    const fileName = `Responsiva_${data.service_tag || data.equipo_id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    doc.pipe(res);

    const path = require('path');
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

    // ===== ENCABEZADO =====
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

    // ===== DATOS PRINCIPALES =====
    doc.font('Helvetica')
      .fontSize(10.5)
      .text(
        'Mediante este documento, el área de sistemas de la empresa Foresight Mexico CO LTD S de RL de CV, hace entrega del equipo marca y modelo',
        55,
        205,
        { width: 370, align: 'left' }
      );

    doc.font('Helvetica-Bold')
      .text(`${data.marca || ''} ${data.modelo || ''}`.trim() || 'N/A', 415, 222, {
        underline: true,
        width: 120,
        align: 'center'
      });

    doc.font('Helvetica')
      .text('con el numero de serie', 55, 252);

    doc.font('Helvetica-Bold')
      .text(`${data.service_tag || 'N/A'}`, 165, 252, {
        underline: true,
        width: 95,
        align: 'center'
      });

    doc.font('Helvetica')
      .text('el cual se entrega a', 360, 252);

    doc.font('Helvetica-Bold')
      .text(`${data.nombre_completo || 'N/A'}`, 55, 280, {
        underline: true,
        width: 250,
        align: 'center'
      });

    doc.font('Helvetica')
      .text(', del area de:', 315, 280);

    doc.font('Helvetica-Bold')
      .text(`${data.departamento || 'N/A'}`, 420, 280, {
        underline: true,
        width: 110,
        align: 'center'
      });

    doc.font('Helvetica')
      .text('quien tendra uso y responsabilidad sobre el desde:', 55, 308);

    doc.font('Helvetica-Bold')
      .text(`${fechaAsignacion}`, 365, 308, {
        underline: true,
        width: 130,
        align: 'center'
      });

    // ===== PÁRRAFO LEGAL 1 =====
    doc.font('Helvetica')
      .fontSize(10)
      .text(
        'El receptor, asume total responsabilidad y el cuidado de dicho equipo completo y parcial del mismo. Se compromete a utilizarlo con un uso estrictamente laboral. No se podrá instalar programas ajenos al uso de la empresa, hacer modificaciones de cualquier tipo al equipo, contando con las siguientes especificaciones.',
        55,
        350,
        { width: 500, align: 'justify' }
      );

    // ===== ESPECIFICACIONES =====
    doc.font('Helvetica-Bold')
      .fontSize(10)
      .text(`Especificaciones: ${specsTexto}`, 55, 420, {
        width: 500,
        align: 'center'
      });

// ===== ESTADO DEL EQUIPO =====
doc.image(estadoEquipoPath, 75, 445, {
  fit: [460, 110],
  align: 'center',
  valign: 'center'
});

// ===== TEXTOS LEGALES INFERIORES =====
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

// ===== FIRMAS =====
const yFirmas = 715;

doc.moveTo(90, yFirmas).lineTo(240, yFirmas).stroke();
doc.moveTo(350, yFirmas).lineTo(520, yFirmas).stroke();

doc.font('Helvetica-Bold')
  .fontSize(10)
  .text(entregadoPor, 90, yFirmas + 8, {
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

console.log('Página actual:', doc.bufferedPageRange());

    doc.end();
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


const fs = require('fs');

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

module.exports = {
  getInventarioNuevo,
  getInventarioViejo,
  getResponsivaPDF,
  postSubirResponsivaFirmada,
  getResponsivaFirmada
};