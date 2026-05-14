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

async function findUserByCorreo(correo) {
  const rows = await query(
    `
    SELECT 
      usuario_id,
      nombre_completo,
      nomina,
      correo,
      password_hash,
      tipo_usuario,
      activo,
      intentos_fallidos,
      bloqueado_hasta,
      ultimo_login
    FROM usuarios_sistema
    WHERE correo = ?
    LIMIT 1
    `,
    [correo]
  );

  return rows[0] || null;
}

async function findUserById(usuarioId) {
  const rows = await query(
    `
    SELECT 
      usuario_id,
      nombre_completo,
      nomina,
      correo,
      tipo_usuario,
      activo,
      ultimo_login
    FROM usuarios_sistema
    WHERE usuario_id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

  return rows[0] || null;
}

async function createUser({
  nombreCompleto,
  nomina,
  correo,
  passwordHash,
  tipoUsuario,
}) {
  const result = await query(
    `
    INSERT INTO usuarios_sistema (
      nombre_completo,
      nomina,
      correo,
      password_hash,
      tipo_usuario,
      activo
    )
    VALUES (?, ?, ?, ?, ?, 1)
    `,
    [
      nombreCompleto,
      nomina || null,
      correo,
      passwordHash,
      tipoUsuario || 'IT',
    ]
  );

  return result.insertId;
}

async function resetLoginSuccess(usuarioId) {
  await query(
    `
    UPDATE usuarios_sistema
    SET 
      intentos_fallidos = 0,
      bloqueado_hasta = NULL,
      ultimo_login = NOW()
    WHERE usuario_id = ?
    `,
    [usuarioId]
  );
}

async function registerFailedAttempt(usuarioId, failedAttempts, blockedUntil) {
  await query(
    `
    UPDATE usuarios_sistema
    SET 
      intentos_fallidos = ?,
      bloqueado_hasta = ?
    WHERE usuario_id = ?
    `,
    [failedAttempts, blockedUntil, usuarioId]
  );
}

async function listUsers() {
  return query(
    `
    SELECT 
      usuario_id,
      nombre_completo,
      nomina,
      correo,
      tipo_usuario,
      activo,
      ultimo_login,
      creado_en
    FROM usuarios_sistema
    ORDER BY usuario_id DESC
    `
  );
}

module.exports = {
  findUserByCorreo,
  findUserById,
  createUser,
  resetLoginSuccess,
  registerFailedAttempt,
  listUsers,
};