const registroModel = require('../models/registro.model');

async function registrarEquipo(body) {

    const {
        monitoreo_id,
        empleado,
        equipo,
        windows
    } = body;

    if (!equipo?.service_tag) {
        const error = new Error('Service tag requerido');
        error.statusCode = 400;
        throw error;
    }

    if (!equipo?.marca || !equipo?.modelo) {
        const error = new Error('Marca y modelo requeridos');
        error.statusCode = 400;
        throw error;
    }

    const marca = equipo.marca ?? null;
    const modelo = equipo.modelo ?? null;

    const existe = await registroModel.buscarEquipoPorServiceTag(equipo.service_tag);

    if (existe.length > 0) {
        const error = new Error('El equipo ya está registrado');
        error.statusCode = 400;
        error.extra = { equipo_id: existe[0].equipo_id };
        throw error;
    }

    let empleadoId = null;

    const empleadoRows = await registroModel.buscarEmpleadoPorNombre(empleado.nombre_completo);

    if (empleadoRows.length > 0) {
        empleadoId = empleadoRows[0].empleado_id;
    } else {
        const empleadoResult = await registroModel.insertarEmpleado(empleado);
        empleadoId = empleadoResult.insertId;
    }

    let marcaId = null;

    const marcaRows = await registroModel.buscarMarcaModelo(marca, modelo);

    if (marcaRows.length > 0) {
        marcaId = marcaRows[0].marca_id;
    } else {

    const marcaInsert = await registroModel.insertarMarcaModelo(marca, modelo);
        marcaId = marcaInsert.insertId;
    }

    const fechaCompraFinal = equipo.fecha_compra || equipo.fecha_asig || '2001-01-01';
    const fechaAsignacionFinal = equipo.fecha_asig || null;

    // console.log('[DEBUG][registrarEquipo] fecha_compra original:', equipo.fecha_compra);
    // console.log('[DEBUG][registrarEquipo] fecha_asig original:', equipo.fecha_asig);
    // console.log('[DEBUG][registrarEquipo] fecha_compra final:', fechaCompraFinal);
    // console.log('[DEBUG][registrarEquipo] fecha_asig final:', fechaAsignacionFinal);


    const equipoResult = await registroModel.insertarEquipo({
    empleadoId,
    marcaId,
    tipo: equipo.tipo,
    service_tag: equipo.service_tag,
    nombre_equipo: equipo.nombre_equipo,
    specs: equipo.specs,
    fecha_compra: fechaCompraFinal,
    fecha_asig: fechaAsignacionFinal,
    start_warranty: equipo.start_warranty,
    end_warranty: equipo.end_warranty
    });

    const equipoId = equipoResult.insertId;

    if (windows) {
        await registroModel.insertarDatosWindows(equipoId, windows);
    }

    if (monitoreo_id) {
        await registroModel.actualizarMonitoreoDespuesRegistro(monitoreo_id, equipoId);
    }

    return {
        status: 'ok',
        equipo_id: equipoId
    };
}

async function liberarEquipo(equipoId) {
    if (!Number.isInteger(equipoId) || equipoId <= 0) {
        const error = new Error('ID de equipo inválido');
        error.statusCode = 400;
        throw error;
    }

    const equipoRows = await registroModel.buscarEquipoPorId(equipoId);

    if (equipoRows.length === 0) {
        const error = new Error('Equipo no encontrado');
        error.statusCode = 404;
        throw error;
    }

        await registroModel.liberarMonitoreoPorEquipoId(equipoId);
        await registroModel.eliminarDatosWindowsPorEquipoId(equipoId);
        await registroModel.eliminarDocumentosPorEquipoId(equipoId);
        await registroModel.eliminarFirmasPendientesPorEquipoId(equipoId);
        await registroModel.eliminarEquipoPorId(equipoId);

    return {
        status: 'ok',
        equipo_id: equipoId,
        liberado: true
    };
}
module.exports = {
  registrarEquipo,
  liberarEquipo
};