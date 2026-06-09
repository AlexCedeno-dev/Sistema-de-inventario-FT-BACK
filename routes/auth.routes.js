const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { requireAuth, requireRol } = require('../middlewares/auth.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, message: 'Demasiados intentos. Intenta más tarde.' },
});

// ─── Públicas ─────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

// ─── Gestión de usuarios (solo ADMIN_IT) ──────────────────────────────────────
router.get('/usuarios',    requireAuth, requireRol('ADMIN_IT'), authController.listUsers);
router.post('/usuarios',   requireAuth, requireRol('ADMIN_IT'), authController.createUser);
router.put('/usuarios/:usuarioId',                    requireAuth, requireRol('ADMIN_IT'), authController.editarUsuario);
router.patch('/usuarios/:usuarioId/estado',           requireAuth, requireRol('ADMIN_IT'), authController.cambiarEstado);
router.patch('/usuarios/:usuarioId/reset-password',   requireAuth, requireRol('ADMIN_IT'), authController.resetearPassword);
router.patch('/usuarios/:usuarioId/desbloquear',      requireAuth, requireRol('ADMIN_IT'), authController.desbloquearUsuario);

module.exports = router;
