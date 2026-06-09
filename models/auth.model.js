const { crearConexion } = require('../configs/db');

async function query(sql, params = []) {
  const connection = await crearConexion();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}

// ─── Login / sesión ───────────────────────────────────────────────────────────

async function findUserByCorreo(correo) {
  const rows = await query(
    `SELECT usuario_id, nombre_completo, nomina, correo,
            password_hash, tipo_usuario, activo,
            intentos_fallidos, bloqueado_hasta, ultimo_login
     FROM usuarios_sistema
     WHERE correo = ?
     LIMIT 1`,
    [correo]
  );
  return rows[0] || null;
}

async function findUserById(usuarioId) {
  const rows = await query(
    `SELECT usuario_id, nombre_completo, nomina, correo,
            tipo_usuario, activo, ultimo_login
     FROM usuarios_sistema
     WHERE usuario_id = ?
     LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

async function resetLoginSuccess(usuarioId) {
  await query(
    `UPDATE usuarios_sistema
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW()
     WHERE usuario_id = ?`,
    [usuarioId]
  );
}

async function registerFailedAttempt(usuarioId, failedAttempts, blockedUntil) {
  await query(
    `UPDATE usuarios_sistema
     SET intentos_fallidos = ?, bloqueado_hasta = ?
     WHERE usuario_id = ?`,
    [failedAttempts, blockedUntil, usuarioId]
  );
}

// ─── Listado ──────────────────────────────────────────────────────────────────

async function listUsers() {
  return query(
    `SELECT usuario_id, nombre_completo, nomina, correo,
            tipo_usuario, activo, intentos_fallidos,
            bloqueado_hasta, ultimo_login, creado_en,
            creado_por_id, actualizado_en
     FROM usuarios_sistema
     ORDER BY usuario_id DESC`
  );
}

// ─── Crear ────────────────────────────────────────────────────────────────────

async function createUser({ nombreCompleto, nomina, correo, passwordHash, tipoUsuario, creadoPorId = null }) {
  const result = await query(
    `INSERT INTO usuarios_sistema
       (nombre_completo, nomina, correo, password_hash, tipo_usuario, activo, creado_por_id)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [nombreCompleto, nomina || null, correo, passwordHash, tipoUsuario || 'IT', creadoPorId]
  );
  return result.insertId;
}

// ─── Editar ───────────────────────────────────────────────────────────────────

async function updateUser({ usuarioId, nombreCompleto, nomina, correo, tipoUsuario }) {
  await query(
    `UPDATE usuarios_sistema
     SET nombre_completo = ?, nomina = ?, correo = ?, tipo_usuario = ?
     WHERE usuario_id = ?`,
    [nombreCompleto, nomina || null, correo, tipoUsuario, usuarioId]
  );
}

// ─── Activar / Desactivar ─────────────────────────────────────────────────────

async function setActivo(usuarioId, activo) {
  await query(
    `UPDATE usuarios_sistema SET activo = ? WHERE usuario_id = ?`,
    [activo ? 1 : 0, usuarioId]
  );
}

/** Cuenta admins activos (IT o ADMIN_IT) para evitar dejar el sistema sin admin. */
async function contarAdminsActivos() {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM usuarios_sistema
     WHERE activo = 1
       AND tipo_usuario IN ('IT','ADMIN_IT')`
  );
  return Number(rows[0].total);
}

// ─── Reset de contraseña ──────────────────────────────────────────────────────

async function resetPassword(usuarioId, passwordHash) {
  await query(
    `UPDATE usuarios_sistema
     SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE usuario_id = ?`,
    [passwordHash, usuarioId]
  );
}

// ─── Desbloquear ──────────────────────────────────────────────────────────────

async function desbloquearUsuario(usuarioId) {
  await query(
    `UPDATE usuarios_sistema
     SET intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE usuario_id = ?`,
    [usuarioId]
  );
}

// ─── Auditoría de usuarios ────────────────────────────────────────────────────

async function insertarAuditoriaUsuario({
  usuarioAfectadoId,
  accion,
  realizadoPorId,
  realizadoPorNombre,
  realizadoPorRol,
  descripcion = null,
}) {
  try {
    await query(
      `INSERT INTO auditoria_usuarios
         (usuario_afectado_id, accion, realizado_por_id,
          realizado_por_nombre, realizado_por_rol, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioAfectadoId, accion, realizadoPorId,
       realizadoPorNombre, realizadoPorRol, descripcion]
    );
  } catch (err) {
    console.error('[auditoria_usuarios] Error:', err.message);
  }
}

module.exports = {
  findUserByCorreo,
  findUserById,
  createUser,
  resetLoginSuccess,
  registerFailedAttempt,
  listUsers,
  updateUser,
  setActivo,
  contarAdminsActivos,
  resetPassword,
  desbloquearUsuario,
  insertarAuditoriaUsuario,
};
