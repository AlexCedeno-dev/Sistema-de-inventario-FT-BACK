const { crearConexion } = require('../configs/db');
const { normalizeRol } = require('../middlewares/auth.middleware');

// ─── Campos sensibles ─────────────────────────────────────────────────────────
const CAMPOS_SENSIBLES = [
  'password',
  'password_hash',
  'passwordhash',
  'token',
  'secret',
  'bitlocker',
  'clave',
  'credencial',
  'contrasena',
  'contraseña',
  'bios_password',
  'biospassword',
  'local_user_windows',
  'password_windows',
  'passwordwindows',
  'usuario_admin',
  'usuarioadmin',
  'password_admin',
  'passwordadmin',
  'correo_enrrolado',
  'correoenrrolado',
  'password_enrrolado',
  'passwordenrrolado',
  'usuario_nas',
  'usuarionas',
  'password_nas',
  'passwordnas',
  'usuario_vpn',
  'usuariovpn',
  'password_vpn',
  'passwordvpn',
  'usuario_osticket',
  'usuariosticket',
  'password_osticket',
  'passwordosticket',
];

/** Devuelve true si el nombre de clave coincide con algún campo sensible. */
function esCampoSensible(clave) {
  const claveMin = clave.toLowerCase().replace(/[_\-]/g, '');
  return CAMPOS_SENSIBLES.some((s) => claveMin.includes(s.replace(/[_\-]/g, '')));
}

/**
 * Aplana un objeto anidado en un mapa plano clave→valor.
 * Ej: { equipo: { bios_password: 'x' } } → { 'bios_password': 'x' }
 * Útil para comparar estructuras con distinto nivel de anidamiento.
 */
function aplanar(obj, resultado = {}) {
  if (!obj || typeof obj !== 'object') return resultado;
  for (const [clave, valor] of Object.entries(obj)) {
    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
      aplanar(valor, resultado);
    } else {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

/**
 * Sanitiza un objeto para auditoría.
 * Campos sensibles → '[OMITIDO]'.
 * Funciona recursivamente. No modifica el objeto original.
 */
function sanitizeAuditData(data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditData);

  const limpio = {};
  for (const [clave, valor] of Object.entries(data)) {
    if (esCampoSensible(clave)) {
      limpio[clave] = '[OMITIDO]';
    } else if (typeof valor === 'object' && valor !== null) {
      limpio[clave] = sanitizeAuditData(valor);
    } else {
      limpio[clave] = valor;
    }
  }
  return limpio;
}

/**
 * Compara datos_anteriores y datos_nuevos para campos sensibles.
 * Devuelve un objeto con:
 *   - campos_sensibles_modificados: string[]  → lista de campos que cambiaron
 *   - datos_nuevos sanitizados con marcas contextuales:
 *       '[CAMBIADO - VALOR OMITIDO]'  cuando el campo cambió respecto al anterior
 *       '[ENVIADO - VALOR OMITIDO]'   cuando el campo viene en nuevo pero no era comparable
 *       '[OMITIDO]'                   cuando el campo sensible no cambió (o es null)
 *
 * Nunca guarda el valor real de ningún campo sensible.
 *
 * @param {object} nuevo       - datos_nuevos (puede ser anidado)
 * @param {object} anterior    - datos_anteriores (puede ser plano o anidado)
 * @returns {{ sanitizado: object, camposSensiblesModificados: string[] }}
 */
function diffAuditData(nuevo, anterior) {
  const anteriorPlano = aplanar(anterior || {});
  const camposSensiblesModificados = [];

  function procesarObjeto(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(procesarObjeto);

    const resultado = {};
    for (const [clave, valorNuevo] of Object.entries(obj)) {
      if (esCampoSensible(clave)) {
        // Nunca guardamos el valor real
        const tieneValorNuevo = valorNuevo !== null && valorNuevo !== undefined && valorNuevo !== '';

        if (!tieneValorNuevo) {
          // No vino valor → omitir silenciosamente (no hubo intención de cambio)
          resultado[clave] = null;
          continue;
        }

        // Buscar el valor anterior en el objeto aplanado
        const valorAnterior = anteriorPlano[clave];
        const hayAnteriorComparable =
          valorAnterior !== null && valorAnterior !== undefined && valorAnterior !== '';

        if (hayAnteriorComparable) {
          // Ambos tienen valor — comparamos sin exponer ninguno
          if (String(valorNuevo) !== String(valorAnterior)) {
            resultado[clave] = '[CAMBIADO - VALOR OMITIDO]';
            camposSensiblesModificados.push(clave);
          } else {
            resultado[clave] = '[SIN CAMBIO - VALOR OMITIDO]';
          }
        } else {
          // No hay anterior comparable → vino un valor nuevo
          resultado[clave] = '[ENVIADO - VALOR OMITIDO]';
          camposSensiblesModificados.push(clave);
        }
      } else if (typeof valorNuevo === 'object' && valorNuevo !== null) {
        resultado[clave] = procesarObjeto(valorNuevo);
      } else {
        resultado[clave] = valorNuevo;
      }
    }
    return resultado;
  }

  const sanitizado = procesarObjeto(nuevo);
  return { sanitizado, camposSensiblesModificados };
}

/**
 * Registra un evento de auditoría en auditoria_equipos.
 * Si falla el INSERT, loguea el error pero NO interrumpe el flujo principal.
 *
 * Cuando se pasan ambos datosAnteriores y datosNuevos (caso EDICION),
 * usa diffAuditData para marcar cambios en campos sensibles con contexto.
 * En cualquier otro caso usa sanitizeAuditData.
 *
 * @param {object} params
 * @param {number}      params.equipoId
 * @param {string}      [params.serviceTag]
 * @param {string}      params.accion          - 'ALTA'|'EDICION'|'ENTREGA'|'LIBERACION'|'BAJA'|'REASIGNACION'
 * @param {object}      params.realizadoPor    - req.user: { usuario_id, nombre_completo, tipo_usuario }
 * @param {string}      [params.descripcion]
 * @param {object|null} [params.datosAnteriores]
 * @param {object|null} [params.datosNuevos]
 */
async function registrarAuditoriaEquipo({
  equipoId,
  serviceTag = null,
  accion,
  realizadoPor,
  descripcion = null,
  datosAnteriores = null,
  datosNuevos = null,
}) {
  try {
    const rolNormalizado = normalizeRol(realizadoPor?.tipo_usuario || '');

    // datos_anteriores: siempre sanitize simple (nunca mostramos valores sensibles del pasado)
    const anteriorLimpio = datosAnteriores
      ? JSON.stringify(sanitizeAuditData(datosAnteriores))
      : null;

    // datos_nuevos: si hay anterior para comparar → diff con marcas contextuales
    //               si no hay anterior → sanitize simple
    let nuevoLimpio = null;
    if (datosNuevos) {
      if (datosAnteriores) {
        const { sanitizado, camposSensiblesModificados } = diffAuditData(datosNuevos, datosAnteriores);
        // Agregar lista de campos sensibles que cambiaron al nivel raíz
        if (camposSensiblesModificados.length > 0) {
          sanitizado._campos_sensibles_modificados = camposSensiblesModificados;
        }
        nuevoLimpio = JSON.stringify(sanitizado);
      } else {
        nuevoLimpio = JSON.stringify(sanitizeAuditData(datosNuevos));
      }
    }

    const db = await crearConexion();
    try {
      await db.execute(
        `INSERT INTO auditoria_equipos
           (equipo_id, service_tag, accion,
            realizado_por_id, realizado_por_nombre, realizado_por_rol,
            descripcion, datos_anteriores, datos_nuevos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipoId,
          serviceTag || null,
          accion,
          realizadoPor?.usuario_id || null,
          realizadoPor?.nombre_completo || 'Desconocido',
          rolNormalizado,
          descripcion || null,
          anteriorLimpio,
          nuevoLimpio,
        ]
      );
    } finally {
      await db.end();
    }
  } catch (err) {
    console.error('[auditoria] Error al registrar auditoría de equipo:', err.message);
  }
}

module.exports = {
  sanitizeAuditData,
  diffAuditData,
  registrarAuditoriaEquipo,
};
