const registroModel = require('../models/registro.model');

async function registrarEquipo(body) {

    const {
        monitoreo_id,
        empleado,
        equipo,
        windows,
        accesos
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
        const equipoExistente = existe[0];

        const estaAsignado = equipoExistente.empleado_id !== null;
        const estaActivo = equipoExistente.estado_registro !== 'LIBERADO';

        if (estaAsignado && estaActivo) {
            const error = new Error('El equipo ya está registrado y asignado a un empleado');
            error.statusCode = 400;
            error.extra = { equipo_id: equipoExistente.equipo_id };
            throw error;
        }
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
        bios_password: equipo.bios_password,
        specs: equipo.specs,
        fecha_compra: fechaCompraFinal,
        fecha_asig: fechaAsignacionFinal,
        start_warranty: equipo.start_warranty,
        end_warranty: equipo.end_warranty,
        permiso_salida: equipo.permiso_salida ?? 0
    });

    const equipoId = equipoResult.insertId;

    if (windows) {
        await registroModel.insertarDatosWindows(equipoId, windows);
    }

    if (windows?.correoEnrollado || windows?.passwordEnrollado) {
        await registroModel.insertarLicenciaEnrollado(empleadoId, {
        correo_enrrolado: windows.correoEnrollado,
        password_enrrolado: windows.passwordEnrollado,
        licencia_office: equipo.licencia_office
    });
    }

    if (accesos?.usuarioNAS || accesos?.passwordNAS) {
        await registroModel.insertarLicenciaNas(empleadoId, {
            usuario_nas: accesos.usuarioNAS,
            password_nas: accesos.passwordNAS
        });
    }

    if (accesos?.usuarioVPN || accesos?.passwordVPN) {
        await registroModel.insertarLicenciaVpn(empleadoId, {
            usuario_vpn: accesos.usuarioVPN,
            password_vpn: accesos.passwordVPN
        });
    }

    if (accesos?.usuarioOsticket || accesos?.passwordOsticket) {
        await registroModel.insertarLicenciaOsticket(empleadoId, {
            usuario_osticket: accesos.usuarioOsticket,
            password_osticket: accesos.passwordOsticket
        });
    }

    if (monitoreo_id) {
        await registroModel.actualizarMonitoreoDespuesRegistro(monitoreo_id, equipoId);
    }

    return {
        status: 'ok',
        equipo_id: equipoId
    };
}

async function liberarEquipo(equipoId, datosLiberacion = {}) {
    if (!Number.isInteger(equipoId) || equipoId <= 0) {
        const error = new Error('ID de equipo inválido');
        error.statusCode = 400;
        throw error;
    }

    const liberadoPor = String(datosLiberacion.liberadoPor || '').trim();

    const tipoRaw = String(datosLiberacion.tipoLiberador || '')
        .trim()
        .toUpperCase();

    const tipoLiberador = tipoRaw === 'EMPLEADO_IT'
        ? 'IT'
        : tipoRaw;

    if (!liberadoPor) {
        const error = new Error('Falta nombre de quien libera el equipo');
        error.statusCode = 400;
        throw error;
    }

    if (!['IT', 'BECARIO'].includes(tipoLiberador)) {
        const error = new Error('Tipo de liberador inválido');
        error.statusCode = 400;
        throw error;
    }

    const equipoRows = await registroModel.obtenerDatosHistorialLiberacion(equipoId);

    if (equipoRows.length === 0) {
        const error = new Error('Equipo no encontrado');
        error.statusCode = 404;
        throw error;
    }

    const equipo = equipoRows[0];

    await registroModel.insertarHistorialLiberacion({
        equipoId: equipo.equipo_id,
        empleadoId: equipo.empleado_id,
        serviceTag: equipo.service_tag,
        empleadoNombre: equipo.empleado_nombre,
        liberadoPor,
        tipoLiberador
    });

    await registroModel.liberarMonitoreoPorEquipoId(equipoId);
    await registroModel.eliminarDatosWindowsPorEquipoId(equipoId);

    // Ya NO borrar documentos, firmas ni equipo físico
    // await registroModel.eliminarDocumentosPorEquipoId(equipoId);
    // await registroModel.eliminarFirmasPendientesPorEquipoId(equipoId);
    // await registroModel.eliminarEquipoPorId(equipoId);

    await registroModel.liberarEquipoFisico(equipoId);

    return {
        status: 'ok',
        equipo_id: equipoId,
        liberado: true,
        liberado_por: liberadoPor,
        tipo_liberador: tipoLiberador
    };
}

async function actualizarEquipo(equipoId, body) {
    if (!Number.isInteger(equipoId) || equipoId <= 0) {
        const error = new Error('ID de equipo inválido');
        error.statusCode = 400;
        throw error;
    }

    const rows = await registroModel.buscarEquipoPorId(equipoId);

    if (!rows.length) {
        const error = new Error('Equipo no encontrado');
        error.statusCode = 404;
        throw error;
    }

    const empleadoId = rows[0].empleado_id;

    await registroModel.actualizarEquipoCompleto(equipoId, empleadoId, body);

    return {
        status: 'ok',
        equipo_id: equipoId,
        actualizado: true
    };
}

async function obtenerDetalleEquipo(equipoId){

 if(!Number.isInteger(equipoId) || equipoId<=0){
   const error =
   new Error('ID inválido');
   error.statusCode=400;
   throw error;
 }

 const rows =
 await registroModel.obtenerDetalleEquipo(
   equipoId
 );

 if(!rows.length){
   const error =
   new Error('Equipo no encontrado');
   error.statusCode=404;
   throw error;
 }

 return rows[0];
}
module.exports = {
  registrarEquipo,
  liberarEquipo,
  actualizarEquipo,
  obtenerDetalleEquipo
};