const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('../models/auth.model');
const { normalizeRol } = require('../middlewares/auth.middleware');

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MINUTES = 15;

const ROLES_VALIDOS = ['IT', 'BECARIO', 'ADMIN_IT', 'BECARIO_IT', 'RH'];

function normalizeCorreo(value) {
  return String(value || '').trim().toLowerCase();
}

function validateStrongPassword(password) {
  const pass = String(password || '');

  if (pass.length < 12) {
    return 'La contraseña debe tener mínimo 12 caracteres';
  }
  if (!/[A-Z]/.test(pass)) {
    return 'La contraseña debe incluir al menos una mayúscula';
  }
  if (!/[a-z]/.test(pass)) {
    return 'La contraseña debe incluir al menos una minúscula';
  }
  if (!/[0-9]/.test(pass)) {
    return 'La contraseña debe incluir al menos un número';
  }
  if (!/[^A-Za-z0-9]/.test(pass)) {
    return 'La contraseña debe incluir al menos un símbolo';
  }

  return null;
}

function buildToken(user) {
  return jwt.sign(
    {
      usuario_id: user.usuario_id,
      nombre_completo: user.nombre_completo,
      correo: user.correo,
      tipo_usuario: user.tipo_usuario,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login({ username, correo, password }) {
  const loginValue = normalizeCorreo(correo || username);

  if (!loginValue || !password) {
    const error = new Error('Usuario y contraseña son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const user = await authModel.findUserByCorreo(loginValue);

  if (!user) {
    const error = new Error('Usuario o contraseña incorrectos');
    error.statusCode = 401;
    throw error;
  }

  if (!user.activo) {
    const error = new Error('Usuario inactivo. Contacta a IT.');
    error.statusCode = 403;
    throw error;
  }

  if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
    const error = new Error('Usuario bloqueado temporalmente. Intenta más tarde.');
    error.statusCode = 423;
    throw error;
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    const failedAttempts = Number(user.intentos_fallidos || 0) + 1;
    let blockedUntil = null;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      blockedUntil = new Date(Date.now() + BLOCK_MINUTES * 60 * 1000);
    }

    await authModel.registerFailedAttempt(user.usuario_id, failedAttempts, blockedUntil);

    const error = new Error('Usuario o contraseña incorrectos');
    error.statusCode = 401;
    throw error;
  }

  await authModel.resetLoginSuccess(user.usuario_id);

  const safeUser = {
    usuario_id: user.usuario_id,
    nombre_completo: user.nombre_completo,
    nomina: user.nomina,
    correo: user.correo,
    tipo_usuario: user.tipo_usuario,
  };

  return { token: buildToken(safeUser), user: safeUser };
}

// ─── Crear usuario ────────────────────────────────────────────────────────────

async function createUser(body, realizadoPor = null) {
  // Normalizar aliases: snake_case, camelCase, estilo script
  const nombreCompleto = body.nombre_completo || body.nombreCompleto || body.nombre || '';
  const nomina        = body.nomina || body.nómina || null;
  const correo        = body.correo || body.usuario || '';
  const password      = body.password || body.passwordTemporal || body.contrasena || body.contraseña || '';
  const tipoUsuario   = body.tipo_usuario || body.tipoUsuario || 'IT';

  const cleanCorreo = normalizeCorreo(correo);

  if (!nombreCompleto || !cleanCorreo || !password) {
    const error = new Error('Nombre, correo/usuario y contraseña son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const cleanTipo = ROLES_VALIDOS.includes(tipoUsuario) ? tipoUsuario : 'IT';

  const passwordError = validateStrongPassword(password);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const exists = await authModel.findUserByCorreo(cleanCorreo);
  if (exists) {
    const error = new Error('Ya existe un usuario con ese correo/usuario');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const creadoPorId = realizadoPor?.usuario_id || null;

  const usuarioId = await authModel.createUser({
    nombreCompleto,
    nomina,
    correo: cleanCorreo,
    passwordHash,
    tipoUsuario: cleanTipo,
    creadoPorId,
  });

  // Auditoría — fire and forget
  if (realizadoPor) {
    authModel.insertarAuditoriaUsuario({
      usuarioAfectadoId: usuarioId,
      accion: 'CREACION',
      realizadoPorId: realizadoPor.usuario_id,
      realizadoPorNombre: realizadoPor.nombre_completo,
      realizadoPorRol: normalizeRol(realizadoPor.tipo_usuario),
      descripcion: `Usuario creado: ${cleanCorreo} — rol: ${cleanTipo}`,
    }).catch((err) => console.error('[audit createUser]', err.message));
  }

  return {
    usuario_id: usuarioId,
    nombre_completo: nombreCompleto,
    nomina: nomina || null,
    correo: cleanCorreo,
    tipo_usuario: cleanTipo,
  };
}

// ─── Editar usuario ───────────────────────────────────────────────────────────

async function editarUsuario(usuarioId, { nombreCompleto, nomina, correo, tipoUsuario }, realizadoPor) {
  if (!nombreCompleto || !correo) {
    const error = new Error('Nombre y correo son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const cleanCorreo = normalizeCorreo(correo);
  const cleanTipo = ROLES_VALIDOS.includes(tipoUsuario) ? tipoUsuario : null;

  if (!cleanTipo) {
    const error = new Error('Rol no válido');
    error.statusCode = 400;
    throw error;
  }

  // Verificar que no exista otro usuario con ese correo
  const existing = await authModel.findUserByCorreo(cleanCorreo);
  if (existing && existing.usuario_id !== Number(usuarioId)) {
    const error = new Error('Ya existe otro usuario con ese correo');
    error.statusCode = 409;
    throw error;
  }

  // Obtener datos anteriores para detectar cambio de rol
  const anterior = await authModel.findUserById(usuarioId);
  if (!anterior) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  await authModel.updateUser({ usuarioId, nombreCompleto, nomina, correo: cleanCorreo, tipoUsuario: cleanTipo });

  const rolCambio = anterior.tipo_usuario !== cleanTipo;
  const accion = rolCambio ? 'CAMBIO_ROL' : 'EDICION';
  const descripcion = rolCambio
    ? `Rol cambiado de ${anterior.tipo_usuario} a ${cleanTipo} para ${cleanCorreo}`
    : `Datos editados para ${cleanCorreo}`;

  authModel.insertarAuditoriaUsuario({
    usuarioAfectadoId: usuarioId,
    accion,
    realizadoPorId: realizadoPor.usuario_id,
    realizadoPorNombre: realizadoPor.nombre_completo,
    realizadoPorRol: normalizeRol(realizadoPor.tipo_usuario),
    descripcion,
  }).catch((err) => console.error('[audit editarUsuario]', err.message));
}

// ─── Activar / Desactivar ─────────────────────────────────────────────────────

async function cambiarEstado(usuarioId, activo, realizadoPor) {
  const usuario = await authModel.findUserById(usuarioId);
  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  // Evitar dejar el sistema sin admins activos
  if (!activo) {
    const rolNorm = normalizeRol(usuario.tipo_usuario);
    if (rolNorm === 'ADMIN_IT') {
      const totalAdmins = await authModel.contarAdminsActivos();
      if (totalAdmins <= 1) {
        const error = new Error('No puedes desactivar al único administrador activo del sistema');
        error.statusCode = 422;
        throw error;
      }
    }
  }

  await authModel.setActivo(usuarioId, activo);

  const accion = activo ? 'ACTIVACION' : 'DESACTIVACION';
  const descripcion = `${accion === 'ACTIVACION' ? 'Activado' : 'Desactivado'}: ${usuario.correo}`;

  authModel.insertarAuditoriaUsuario({
    usuarioAfectadoId: usuarioId,
    accion,
    realizadoPorId: realizadoPor.usuario_id,
    realizadoPorNombre: realizadoPor.nombre_completo,
    realizadoPorRol: normalizeRol(realizadoPor.tipo_usuario),
    descripcion,
  }).catch((err) => console.error('[audit cambiarEstado]', err.message));
}

// ─── Resetear contraseña ──────────────────────────────────────────────────────

async function resetearPassword(usuarioId, passwordTemporal, realizadoPor) {
  const passwordError = validateStrongPassword(passwordTemporal);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const usuario = await authModel.findUserById(usuarioId);
  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const passwordHash = await bcrypt.hash(passwordTemporal, 12);
  await authModel.resetPassword(usuarioId, passwordHash);

  authModel.insertarAuditoriaUsuario({
    usuarioAfectadoId: usuarioId,
    accion: 'RESET_PASSWORD',
    realizadoPorId: realizadoPor.usuario_id,
    realizadoPorNombre: realizadoPor.nombre_completo,
    realizadoPorRol: normalizeRol(realizadoPor.tipo_usuario),
    descripcion: `Contraseña reseteada para ${usuario.correo}`,
  }).catch((err) => console.error('[audit resetearPassword]', err.message));
}

// ─── Desbloquear ──────────────────────────────────────────────────────────────

async function desbloquearUsuario(usuarioId, realizadoPor) {
  const usuario = await authModel.findUserById(usuarioId);
  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  await authModel.desbloquearUsuario(usuarioId);

  authModel.insertarAuditoriaUsuario({
    usuarioAfectadoId: usuarioId,
    accion: 'DESBLOQUEO',
    realizadoPorId: realizadoPor.usuario_id,
    realizadoPorNombre: realizadoPor.nombre_completo,
    realizadoPorRol: normalizeRol(realizadoPor.tipo_usuario),
    descripcion: `Desbloqueado: ${usuario.correo}`,
  }).catch((err) => console.error('[audit desbloquearUsuario]', err.message));
}

// ─── Me ───────────────────────────────────────────────────────────────────────

async function getCurrentUser(usuarioId) {
  const user = await authModel.findUserById(usuarioId);

  if (!user || !user.activo) {
    const error = new Error('Usuario no válido');
    error.statusCode = 401;
    throw error;
  }

  return user;
}

async function listUsers() {
  return authModel.listUsers();
}

module.exports = {
  login,
  createUser,
  getCurrentUser,
  listUsers,
  editarUsuario,
  cambiarEstado,
  resetearPassword,
  desbloquearUsuario,
};
