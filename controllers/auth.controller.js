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
    res.json({ ok: true, token: result.token, user: result.user });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al iniciar sesión',
    });
  }
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true, message: 'Sesión cerrada correctamente' });
}

async function me(req, res) {
  try {
    const user = await authService.getCurrentUser(req.user.usuario_id);
    res.json({ ok: true, user });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al validar sesión',
    });
  }
}

async function createUser(req, res) {
  try {
    const user = await authService.createUser(req.body, req.user);
    res.status(201).json({ ok: true, message: 'Usuario creado correctamente', user });
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
    res.json({ ok: true, users });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error al obtener usuarios' });
  }
}

async function editarUsuario(req, res) {
  try {
    await authService.editarUsuario(req.params.usuarioId, req.body, req.user);
    res.json({ ok: true, message: 'Usuario actualizado correctamente' });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al actualizar usuario',
    });
  }
}

async function cambiarEstado(req, res) {
  try {
    const { activo } = req.body;
    if (activo === undefined || activo === null) {
      return res.status(400).json({ ok: false, message: 'El campo activo es requerido' });
    }
    await authService.cambiarEstado(req.params.usuarioId, activo, req.user);
    const accion = activo ? 'activado' : 'desactivado';
    res.json({ ok: true, message: `Usuario ${accion} correctamente` });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al cambiar estado del usuario',
    });
  }
}

async function resetearPassword(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ ok: false, message: 'La nueva contraseña es requerida' });
    }
    await authService.resetearPassword(req.params.usuarioId, password, req.user);
    res.json({ ok: true, message: 'Contraseña reseteada correctamente' });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al resetear contraseña',
    });
  }
}

async function desbloquearUsuario(req, res) {
  try {
    await authService.desbloquearUsuario(req.params.usuarioId, req.user);
    res.json({ ok: true, message: 'Usuario desbloqueado correctamente' });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Error al desbloquear usuario',
    });
  }
}

module.exports = {
  login,
  logout,
  me,
  createUser,
  listUsers,
  editarUsuario,
  cambiarEstado,
  resetearPassword,
  desbloquearUsuario,
};
