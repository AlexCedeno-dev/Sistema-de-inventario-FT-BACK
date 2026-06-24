const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { crearConexion } = require('../configs/db');
const {
  obtenerMonitoreosDisponiblesOls,
  registrarEstacionOls,
  listarEstacionesOls,
  darBajaEstacionOls,
  reactivarEstacionOls,
  actualizarEstacionOls,
} = require('../models/estacionesOls.model');
const { registrarAuditoriaEquipo } = require('../models/auditoria.model');

function mmToPt(mm) { return mm * 2.8346; }

const TIPOS_ESTACION_VALIDOS = ['INYECCION', 'PINTURA', 'ENSAMBLE'];

async function obtenerMonitoreosDisponibles(req, res) {
  try {
    const rows = await obtenerMonitoreosDisponiblesOls();
    return res.json(rows);
  } catch (error) {
    console.error('[obtenerMonitoreosDisponibles] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function altaEstacionOls(req, res) {
  try {
    const { monitoreo_id, nombre_estacion, tipo_estacion, planta, linea, turno,
            fecha_compra, start_warranty, end_warranty } = req.body;

    if (!monitoreo_id) {
      return res.status(400).json({ error: 'El campo monitoreo_id es obligatorio.' });
    }

    // Verificar que el monitoreo exista y no esté ya registrado
    const db = await crearConexion();
    let monitoreo;
    try {
      const [rows] = await db.execute(
        `SELECT * FROM monitoreo_equipos
         WHERE monitoreo_id = ? AND registrado_en_inventario = 0
         LIMIT 1`,
        [monitoreo_id]
      );
      monitoreo = rows[0] ?? null;
    } finally {
      await db.end();
    }

    if (!monitoreo) {
      return res.status(400).json({
        error: 'El monitoreo no existe o ya fue registrado en inventario.',
      });
    }

    if (!nombre_estacion?.trim()) {
      return res.status(400).json({ error: 'El campo nombre_estacion es obligatorio.' });
    }
    if (!tipo_estacion || !TIPOS_ESTACION_VALIDOS.includes(tipo_estacion)) {
      return res.status(400).json({
        error: `El campo tipo_estacion es obligatorio y debe ser uno de: ${TIPOS_ESTACION_VALIDOS.join(', ')}.`,
      });
    }
    if (!planta?.trim()) {
      return res.status(400).json({ error: 'El campo planta es obligatorio.' });
    }

    const resultado = await registrarEstacionOls(
      monitoreo,
      {
        nombre_estacion: nombre_estacion.trim(),
        tipo_estacion,
        planta: planta.trim(),
        linea: linea?.trim() || null,
        turno: turno?.trim() || null,
        fecha_compra: fecha_compra ?? null,
        start_warranty: start_warranty ?? null,
        end_warranty: end_warranty ?? null,
      },
      req.user.usuario_id,
      req.user.nombre_completo ?? 'Desconocido',
      req.user.tipo_usuario ?? 'Desconocido'
    );

    return res.status(201).json(resultado);
  } catch (error) {
    console.error('[altaEstacionOls] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function listarEstacionesOlsController(req, res) {
  try {
    const estado = req.query.estado === 'BAJA' ? 'BAJA' : 'ACTIVA';
    const rows = await listarEstacionesOls(estado);
    return res.json(rows);
  } catch (error) {
    console.error('[listarEstacionesOlsController] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function postDarBajaEstacionOls(req, res) {
  try {
    const estacionId = Number(req.params.estacionId);
    const snapshot = await darBajaEstacionOls(estacionId);

    registrarAuditoriaEquipo({
      equipoId:        snapshot.equipo_id,
      serviceTag:      snapshot.service_tag || null,
      accion:          'BAJA',
      realizadoPor:    req.user,
      descripcion:     `Estación OLS dada de baja por ${req.user?.nombre_completo || 'Desconocido'}`,
      datosAnteriores: snapshot,
      datosNuevos:     { estado: 'BAJA', equipos_estado_registro: 'LIBERADO' },
    });

    return res.json({ ok: true, estacion_id: estacionId });
  } catch (error) {
    console.error('[postDarBajaEstacionOls] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function postReactivarEstacionOls(req, res) {
  try {
    const estacionId = Number(req.params.estacionId);
    const snapshot = await reactivarEstacionOls(estacionId);

    registrarAuditoriaEquipo({
      equipoId:        snapshot.equipo_id,
      serviceTag:      snapshot.service_tag || null,
      accion:          'ALTA',
      realizadoPor:    req.user,
      descripcion:     `Estación OLS reactivada por ${req.user?.nombre_completo || 'Desconocido'}`,
      datosAnteriores: snapshot,
      datosNuevos:     { estado: 'ACTIVA', equipos_estado_registro: 'activo' },
    });

    return res.json({ ok: true, estacion_id: estacionId });
  } catch (error) {
    console.error('[postReactivarEstacionOls] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function putEditarEstacionOls(req, res) {
  try {
    const estacionId = Number(req.params.estacionId);
    const { nombre_estacion, tipo_estacion, planta, linea, turno } = req.body;

    if (!nombre_estacion?.trim()) {
      return res.status(400).json({ error: 'El campo nombre_estacion es obligatorio.' });
    }
    if (!tipo_estacion || !TIPOS_ESTACION_VALIDOS.includes(tipo_estacion)) {
      return res.status(400).json({
        error: `El campo tipo_estacion es obligatorio y debe ser uno de: ${TIPOS_ESTACION_VALIDOS.join(', ')}.`,
      });
    }
    if (!planta?.trim()) {
      return res.status(400).json({ error: 'El campo planta es obligatorio.' });
    }

    const snapshot = await actualizarEstacionOls(estacionId, {
      nombre_estacion: nombre_estacion.trim(),
      tipo_estacion,
      planta: planta.trim(),
      linea: linea?.trim() || null,
      turno: turno?.trim() || null,
    });

    registrarAuditoriaEquipo({
      equipoId:        snapshot.equipo_id,
      serviceTag:      snapshot.service_tag ?? null,
      accion:          'EDICION',
      realizadoPor:    req.user,
      descripcion:     `Estación OLS editada por ${req.user?.nombre_completo || 'Desconocido'}`,
      datosAnteriores: snapshot,
      datosNuevos:     { nombre_estacion, tipo_estacion, planta, linea, turno },
    });

    return res.json({ ok: true, estacion_id: estacionId });
  } catch (error) {
    console.error('[putEditarEstacionOls] Error:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function getEtiquetaQrOLSPDF(req, res) {
  try {
    const estacionId = Number(req.params.estacionId);
    if (!estacionId) {
      return res.status(400).json({ error: 'ID de estación inválido' });
    }

    const db = await crearConexion();
    let data;
    try {
      const [rows] = await db.execute(
        `SELECT eo.estacion_id, eo.activo_fijo, eo.fecha_alta,
                e.service_tag, e.qr_token,
                md.marca, md.modelo,
                me.tipo_equipo
         FROM estaciones_ols eo
         JOIN  equipos e              ON e.equipo_id          = eo.equipo_id
         LEFT JOIN marca_dispositivos md ON md.marca_id       = e.marca_id
         LEFT JOIN monitoreo_equipos  me ON me.equipo_id_registrado = eo.equipo_id
         WHERE eo.estacion_id = ?
         LIMIT 1`,
        [estacionId]
      );
      data = rows[0] ?? null;
    } finally {
      await db.end();
    }

    if (!data) return res.status(404).json({ error: 'Estación no encontrada' });
    if (!data.qr_token) return res.status(400).json({ error: 'La estación no tiene QR Token' });

    const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
    const frontendPath = process.env.FRONTEND_PATH || '/inventory-it';
    const qrUrl = `${baseUrl}${frontendPath}/validar-equipo/${data.qr_token}`;

    const qrDataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: 'H', margin: 1, width: 420 });
    const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

    const labelWidth = mmToPt(102);
    const labelHeight = mmToPt(76);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Etiqueta_OLS_${data.activo_fijo || estacionId}.pdf"`);

    const doc = new PDFDocument({ size: [labelWidth, labelHeight], margin: 0 });
    doc.pipe(res);

    doc.rect(0, 0, labelWidth, labelHeight).fill('#FFFFFF');
    doc.fillColor('#000000');

    const logoPath = path.join(__dirname, '../assets/logos/foresight-logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, mmToPt(32), mmToPt(3.5), { fit: [mmToPt(38), mmToPt(15)], align: 'center', valign: 'center' });
    } else {
      doc.font('Helvetica-Bold').fontSize(20).text('FORESIGHT', 0, mmToPt(5), { width: labelWidth, align: 'center' });
    }

    doc.font('Helvetica-Bold').fontSize(10)
      .text('Foresight Mexico Technology Co., Ltd.', 0, mmToPt(17), { width: labelWidth, align: 'center' });

    // QR izquierdo
    doc.image(qrBuffer, mmToPt(5), mmToPt(25), { width: mmToPt(45), height: mmToPt(45) });

    // Separador vertical
    doc.lineWidth(1).moveTo(mmToPt(52), mmToPt(24)).lineTo(mmToPt(52), mmToPt(70)).stroke();

    // Datos derecha
    const x = mmToPt(55);
    const rightWidth = mmToPt(43);
    let y = mmToPt(25);

    function campo(label, value, espacio) {
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#000000')
        .text(label, x, y, { width: rightWidth, height: mmToPt(4), ellipsis: true });
      doc.font('Helvetica').fontSize(8.8).fillColor('#000000')
        .text(value || 'N/A', x, y + mmToPt(4), { width: rightWidth, height: mmToPt(6), ellipsis: true });
      y += espacio || mmToPt(11);
      doc.lineWidth(0.4).strokeColor('#000000')
        .moveTo(x, y - mmToPt(1.5)).lineTo(x + rightWidth, y - mmToPt(1.5)).stroke();
      doc.strokeColor('#000000');
    }

    const tipoRaw = (data.tipo_equipo || '').trim().toUpperCase();
    const tipoLabel = tipoRaw.includes('MINI PC')
      ? 'MINI PC'
      : tipoRaw.includes('DESKTOP')
        ? 'DESKTOP'
        : 'N/A';

    const equipoLabel = [data.marca, data.modelo].filter(Boolean).join(' ') || 'N/A';

    const fechaAltaTexto = data.fecha_alta
      ? new Date(data.fecha_alta).toLocaleDateString('es-MX')
      : 'N/A';

    campo('CÓDIGO ACTIVO', data.activo_fijo);
    campo('TIPO', tipoLabel);
    campo('EQUIPO', equipoLabel);
    campo('FECHA DE ALTA', fechaAltaTexto, mmToPt(10));

    doc.end();
  } catch (error) {
    console.error('[getEtiquetaQrOLSPDF] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  obtenerMonitoreosDisponibles,
  altaEstacionOls,
  listarEstacionesOlsController,
  postDarBajaEstacionOls,
  postReactivarEstacionOls,
  putEditarEstacionOls,
  getEtiquetaQrOLSPDF,
};
