const authService = require('../services/auth.service');

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'nodeguard_session';

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);

    res.cookie(COOKIE_NAME, result.token, getCookieOptions());

    res.json({
      ok: true,
      user: result.user,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al iniciar sesión',
    });
  }
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, {
    path: '/',
  });

  res.json({
    ok: true,
    message: 'Sesión cerrada correctamente',
  });
}

async function me(req, res) {
  try {
    const user = await authService.getCurrentUser(req.user.usuario_id);

    res.json({
      ok: true,
      user,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al validar sesión',
    });
  }
}

async function createUser(req, res) {
  try {
    const user = await authService.createUser(req.body);

    res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente',
      user,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al crear usuario',
    });
  }
}

async function listUsers(req, res) {
  try {
    const users = await authService.listUsers();

    res.json({
      ok: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'Error al obtener usuarios',
    });
  }
}

module.exports = {
  login,
  logout,
  me,
  createUser,
  listUsers,
};