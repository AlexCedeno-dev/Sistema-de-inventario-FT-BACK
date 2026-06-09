const jwt = require('jsonwebtoken');

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'nodeguard_session';

function getTokenFromRequest(req) {
  const cookieToken = req.cookies?.[COOKIE_NAME];

  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  return null;
}

function requireAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Sesión requerida',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      usuario_id: decoded.usuario_id,
      nombre_completo: decoded.nombre_completo,
      correo: decoded.correo,
      tipo_usuario: decoded.tipo_usuario,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Sesión inválida o expirada',
    });
  }
}

// ─── Normalización de roles ───────────────────────────────────────────────────
// Compatibilidad temporal: 'IT' → 'ADMIN_IT', 'BECARIO' → 'BECARIO_IT'
function normalizeRol(tipoUsuario) {
  const mapa = {
    IT:         'ADMIN_IT',
    BECARIO:    'BECARIO_IT',
    ADMIN_IT:   'ADMIN_IT',
    BECARIO_IT: 'BECARIO_IT',
    RH:         'RH',
  };
  return mapa[tipoUsuario] || tipoUsuario;
}

// ─── Guard de roles ───────────────────────────────────────────────────────────
// Uso: requireRol('ADMIN_IT')  |  requireRol('ADMIN_IT', 'BECARIO_IT')
function requireRol(...rolesPermitidos) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: 'Sesión requerida',
      });
    }

    const rolNormalizado = normalizeRol(req.user.tipo_usuario);

    if (!rolesPermitidos.includes(rolNormalizado)) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para realizar esta acción',
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  normalizeRol,
  requireRol,
};