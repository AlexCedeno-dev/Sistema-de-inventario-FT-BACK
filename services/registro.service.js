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
        if (empleado.nomina !== undefined) {
            await registroModel.actualizarDatosEmpleado(
                empleadoId,
                empleado.nomina ?? null,
                empleado.tipo_empleado ?? null,
                empleado.nombre_gerente ?? null
            );
        }
    } else {
        const empleadoResult = await registroModel.insertarEmpleado({
            ...empleado,
            nomina: empleado.nomina ?? null
        });
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

    // Siempre guardar licencia_office si viene, independiente del correo enrollado
    if (equipo?.licencia_office || windows?.correoEnrollado || windows?.passwordEnrollado
        || accesos?.correoTeams || accesos?.passwordTeams
        || accesos?.correoOA || accesos?.passwordOA) {
        await registroModel.insertarLicenciaEnrollado(empleadoId, {
            correo_enrrolado: windows?.correoEnrollado || null,
            password_enrrolado: windows?.passwordEnrollado || null,
            licencia_office: equipo?.licencia_office || null,
            correoTeams: accesos?.correoTeams || null,
            passwordTeams: accesos?.passwordTeams || null,
            correoOA: accesos?.correoOA || null,
            passwordOA: accesos?.passwordOA || null
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

    await registroModel.insertarOtrosAccesos(equipoId, accesos?.otros || []);

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
        ...equipo,
        liberado_por: liberadoPor,
        tipo_liberador: tipoLiberador
    });

    await registroModel.liberarMonitoreoPorEquipoId(equipoId);
    await registroModel.eliminarDatosWindowsPorEquipoId(equipoId);

    // Limpiamos documentos/firma activos de la asignación anterior.
    // Esto NO borra el equipo físico ni rompe el historial de liberación.
    await registroModel.eliminarDocumentosPorEquipoId(equipoId);
    await registroModel.eliminarFirmasPendientesPorEquipoId(equipoId);

    // OJO: esto solo libera el equipo físico, NO lo elimina.
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

    if (!empleadoId) {
        const error = new Error('El equipo no tiene empleado asignado');
        error.statusCode = 400;
        throw error;
    }

    const payload = normalizarPayloadActualizacion(body);

    if (!payload.equipo.service_tag) {
        const error = new Error('Service tag requerido');
        error.statusCode = 400;
        throw error;
    }

    const existenteServiceTag =
        await registroModel.buscarEquipoPorServiceTag(payload.equipo.service_tag);

    const serviceTagEnUsoPorOtroEquipo =
        existenteServiceTag.some(
            (equipo) => Number(equipo.equipo_id) !== equipoId
        );

    if (serviceTagEnUsoPorOtroEquipo) {
        const error = new Error('El service tag ya pertenece a otro equipo');
        error.statusCode = 400;
        throw error;
    }

    await registroModel.actualizarEquipoCompleto(equipoId, empleadoId, payload);

    return {
        status: 'ok',
        equipo_id: equipoId,
        actualizado: true
    };
}

function normalizarPayloadActualizacion(body = {}) {
    const empleado = body.empleado || {};
    const equipo = body.equipo || {};
    const windows = body.windows || {};
    const accesos = body.accesos || {};

    const pick = (...values) => values.find((value) => value !== undefined);

    const textoONull = (valor) => {
        if (valor === undefined || valor === null) return null;

        const texto = String(valor).trim();
        return texto === '' ? null : texto;
    };

    const fechaONull = (valor) => textoONull(valor);
    const booleanoANumero = (valor) => {
        if (valor === true || valor === 1 || valor === '1') return 1;
        if (typeof valor === 'string') {
            return ['true', 'si', 'sí', 'autorizado'].includes(valor.trim().toLowerCase())
                ? 1
                : 0;
        }

        return 0;
    };

    return {
        empleado: {
            nombre_completo: textoONull(pick(
                empleado.nombre_completo,
                empleado.nombreCompleto,
                body.nombre_completo,
                body.nombreEmpleado
            )),
            departamento: textoONull(pick(empleado.departamento, body.departamento)),
            planta: textoONull(pick(empleado.planta, body.planta))
        },
        equipo: {
            marca: textoONull(pick(equipo.marca, body.marca)),
            modelo: textoONull(pick(equipo.modelo, body.modelo)),
            tipo: textoONull(pick(equipo.tipo, body.tipo)),
            service_tag: textoONull(pick(equipo.service_tag, equipo.serviceTag, body.service_tag, body.serviceTag)),
            nombre_equipo: textoONull(pick(equipo.nombre_equipo, equipo.nombreEquipo, body.nombre_equipo, body.hostname)),
            bios_password: textoONull(pick(equipo.bios_password, equipo.biosPassword, body.bios_password)),
            specs: textoONull(pick(equipo.specs, body.specs)),
            fecha_compra: fechaONull(pick(equipo.fecha_compra, equipo.fechaCompra, body.fecha_compra)),
            fecha_asig: fechaONull(pick(equipo.fecha_asig, equipo.fechaAsignacion, body.fecha_asig)),
            start_warranty: fechaONull(pick(equipo.start_warranty, equipo.startWarranty, body.start_warranty)),
            end_warranty: fechaONull(pick(equipo.end_warranty, equipo.endWarranty, body.end_warranty, body.finGarantia)),
            permiso_salida: booleanoANumero(pick(equipo.permiso_salida, equipo.permisoSalida, body.permiso_salida)),
            licencia_office: textoONull(pick(equipo.licencia_office, equipo.licenciaOffice, body.licencia_office))
        },
        windows: {
            usuarioWindows: textoONull(pick(windows.usuarioWindows, windows.local_user_windows, body.local_user_windows)),
            passwordWindows: textoONull(pick(windows.passwordWindows, windows.password_windows, body.password_windows)),
            usuarioAdmin: textoONull(pick(windows.usuarioAdmin, windows.usuario_admin, body.usuario_admin)),
            passwordAdmin: textoONull(pick(windows.passwordAdmin, windows.password_admin, body.password_admin)),
            correoEnrollado: textoONull(pick(windows.correoEnrollado, windows.correo_enrrolado, body.correo_enrrolado)),
            passwordEnrollado: textoONull(pick(windows.passwordEnrollado, windows.password_enrrolado, body.password_enrrolado))
        },
        accesos: {
            usuarioNAS: textoONull(pick(accesos.usuarioNAS, accesos.usuario_nas, body.usuario_nas)),
            passwordNAS: textoONull(pick(accesos.passwordNAS, accesos.password_nas, body.password_nas)),
            usuarioVPN: textoONull(pick(accesos.usuarioVPN, accesos.usuario_vpn, body.usuario_vpn)),
            passwordVPN: textoONull(pick(accesos.passwordVPN, accesos.password_vpn, body.password_vpn)),
            usuarioOsticket: textoONull(pick(accesos.usuarioOsticket, accesos.usuario_osticket, body.usuario_osticket)),
            passwordOsticket: textoONull(pick(accesos.passwordOsticket, accesos.password_osticket, body.password_osticket))
        }
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
