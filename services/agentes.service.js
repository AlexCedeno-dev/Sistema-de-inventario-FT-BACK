const agentesModel = require('../models/agentes.model');

async function listarAgentesDetectados() {
  const rows = await agentesModel.obtenerAgentesDetectados();
  const ahora = new Date();

  return rows.map((agente) => {
    const lastSeenDate = agente.last_seen ? new Date(agente.last_seen) : null;
    const segundosSinReportar = lastSeenDate
      ? (ahora.getTime() - lastSeenDate.getTime()) / 1000
      : Infinity;

    const estaDesconectado = segundosSinReportar > 45;

    let estadoRegistro = 'DISPONIBLE';

    if (agente.registrado_en_inventario === 1) {
      estadoRegistro = 'REGISTRADO';
    } else if (estaDesconectado) {
      estadoRegistro = 'DESCONECTADO';
    } else if (!agente.service_tag) {
      estadoRegistro = 'SIN_SERVICE_TAG';
    }

    return {
      monitoreo_id: agente.monitoreo_id,
      hostname: agente.hostname || '',
      usuario: agente.usuario || '',
      ip: agente.ip || '',
      mac: agente.mac || '',
      service_tag: agente.service_tag || '',
      serial_number: agente.serial_number || '',
      marca: agente.marca || '',
      modelo: agente.modelo || '',
      tipo_equipo: agente.tipo_equipo || '',
      plataforma: agente.plataforma || '',
      tipo_sistema: agente.tipo_sistema || '',
      version_windows: agente.version_windows || '',
      build_windows: agente.build_windows || '',
      edicion_windows: agente.edicion_windows || '',
      cpu_modelo: agente.cpu_modelo || '',
      cpu_nucleos: agente.cpu_nucleos || null,
      cpu_velocidad_mhz: agente.cpu_velocidad_mhz || null,
      ram_total_gb: agente.ram_total_gb || null,
      ram_libre_gb: agente.ram_libre_gb || null,
      ram_uso_gb: agente.ram_uso_gb || null,
      ram_porcentaje: agente.ram_porcentaje || null,
      especificacion: agente.especificacion || '',
      estado_visual: agente.estado_visual || '',
      fecha_reporte: agente.fecha_reporte || null,
      last_seen: agente.last_seen || null,
      registrado_en_inventario: agente.registrado_en_inventario || 0,
      equipo_id_registrado: agente.equipo_id_registrado || null,
      estado_registro: estadoRegistro
    };
  });
}

async function obtenerDatosRegistroDesdeAgente(monitoreoId) {
  if (!Number.isInteger(monitoreoId) || monitoreoId <= 0) {
    const error = new Error('ID inválido');
    error.statusCode = 400;
    throw error;
  }

  const rows = await agentesModel.obtenerAgenteParaRegistro(monitoreoId);

  if (rows.length === 0) {
    const error = new Error('Agente no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const agente = rows[0];

  return {
    monitoreo_id: agente.monitoreo_id,
    empleado: {
      empleado_id: null,
      nombre_completo: '',
      departamento: '',
      planta: ''
    },
    equipo: {
      tipo: agente.tipo_equipo || '',
      service_tag: agente.service_tag || '',
      serial_number: agente.serial_number || '',
      nombre_equipo: agente.hostname || '',
      hostname_detectado: agente.hostname || '',
      agente_device_id: agente.service_tag || '',
      registrado_desde: 'AGENTE',
      fecha_deteccion: agente.fecha_reporte || null,
      fecha_ultima_conexion: agente.last_seen || null,
      marca: agente.marca || '',
      modelo: agente.modelo || '',
      specs: agente.cpu_modelo || '',
      fecha_asig: null,
      fecha_compra: null,
      start_warranty: null,
      end_warranty: null,
      po_number: null,
      oa_number: null
    },
    sistema: {
      plataforma: agente.plataforma || '',
      tipo_sistema: agente.tipo_sistema || '',
      edicion_windows: agente.edicion_windows || '',
      version_windows: agente.version_windows || '',
      build_windows: agente.build_windows || '',
      especificacion: agente.especificacion || '',
      ram_total_gb: agente.ram_total_gb || null,
      ram_porcentaje: agente.ram_porcentaje || null
    }
  };
}


async function listarAgentesAgrupados() {
  const rows = await agentesModel.obtenerAgentes();
  const ahora = new Date();

  const pendientes = [];
  const registrados = [];
  const incidencias = [];

  rows.forEach((agente) => {
    const lastSeenDate = agente.last_seen ? new Date(agente.last_seen) : null;
    const equipoLiberado = agente.estado_equipo === 'LIBERADO';

    const segundosSinReportar = lastSeenDate
      ? (ahora.getTime() - lastSeenDate.getTime()) / 1000
      : Infinity;

    const desconectado = segundosSinReportar > 90;

    const item = {
      monitoreo_id: agente.monitoreo_id,
      hostname: agente.hostname || '',
      usuario: agente.usuario || '',
      ip: agente.ip || '',
      mac: agente.mac || '',
      service_tag: agente.service_tag || '',
      serial_number: agente.serial_number || '',
      marca: agente.marca || '',
      modelo: agente.modelo || '',
      tipo_equipo: agente.tipo_equipo || '',
      plataforma: agente.plataforma || '',
      tipo_sistema: agente.tipo_sistema || '',
      version_windows: agente.version_windows || '',
      build_windows: agente.build_windows || '',
      edicion_windows: agente.edicion_windows || '',
      cpu_modelo: agente.cpu_modelo || '',
      cpu_nucleos: agente.cpu_nucleos || null,
      cpu_velocidad_mhz: agente.cpu_velocidad_mhz || null,
      ram_total_gb: agente.ram_total_gb || null,
      ram_libre_gb: agente.ram_libre_gb || null,
      ram_uso_gb: agente.ram_uso_gb || null,
      ram_porcentaje: agente.ram_porcentaje || null,
      especificacion: agente.especificacion || '',
      estado_visual: agente.estado_visual || '',
      fecha_reporte: agente.fecha_reporte,
      last_seen: agente.last_seen,
      registrado_en_inventario: agente.registrado_en_inventario || 0,
      equipo_id_registrado: agente.equipo_id_registrado || null
    };

    if (equipoLiberado) {
      item.estado_registro = 'PENDIENTE';
      item.registrado_en_inventario = 0;
      item.equipo_id_registrado = null;
      pendientes.push(item);
      return;
    }

    if (agente.registrado_en_inventario === 1) {
      item.estado_registro = 'REGISTRADO';
      registrados.push(item);
      return;
    }

    // 2. SI NO ESTÁ REGISTRADO Y LE FALTA SERVICE TAG
    if (!agente.service_tag) {
      item.estado_registro = 'SIN_SERVICE_TAG';
      incidencias.push(item);
      return;
    }

    // 3. SI NO ESTÁ REGISTRADO Y ESTÁ DESCONECTADO
    if (desconectado) {
      item.estado_registro = 'DESCONECTADO';
      incidencias.push(item);
      return;
    }

    // 4. SI ESTÁ PENDIENTE
    if (agente.pendiente_registro === 1) {
      item.estado_registro = 'PENDIENTE';
      pendientes.push(item);
      return;
    }

    // 5. FALLBACK
    item.estado_registro = 'PENDIENTE';
    pendientes.push(item);
  });

  return {
    resumen: {
      pendientes: pendientes.length,
      registrados: registrados.length,
      incidencias: incidencias.length
    },
    pendientes,
    registrados,
    incidencias
  };
}


module.exports = {
  listarAgentesDetectados,
  obtenerDatosRegistroDesdeAgente,
  listarAgentesAgrupados
};