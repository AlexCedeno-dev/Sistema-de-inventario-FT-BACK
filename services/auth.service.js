const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authModel = require('../models/auth.model');

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MINUTES = 15;

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
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    }
  );
}

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

    await authModel.registerFailedAttempt(
      user.usuario_id,
      failedAttempts,
      blockedUntil
    );

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

  return {
    token: buildToken(safeUser),
    user: safeUser,
  };
}

async function createUser({ nombreCompleto, nomina, correo, password, tipoUsuario }) {
  const cleanCorreo = normalizeCorreo(correo);
  const cleanTipo = tipoUsuario === 'BECARIO' ? 'BECARIO' : 'IT';

  if (!nombreCompleto || !cleanCorreo || !password) {
    const error = new Error('Nombre, correo/usuario y contraseña son requeridos');
    error.statusCode = 400;
    throw error;
  }

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

  const usuarioId = await authModel.createUser({
    nombreCompleto,
    nomina,
    correo: cleanCorreo,
    passwordHash,
    tipoUsuario: cleanTipo,
  });

  return {
    usuario_id: usuarioId,
    nombre_completo: nombreCompleto,
    nomina: nomina || null,
    correo: cleanCorreo,
    tipo_usuario: cleanTipo,
  };
}

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
};