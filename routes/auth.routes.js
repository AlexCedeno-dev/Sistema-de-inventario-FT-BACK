const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    ok: false,
    message: 'Demasiados intentos. Intenta más tarde.',
  },
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

router.post('/usuarios', requireAuth, authController.createUser);
router.get('/usuarios', requireAuth, authController.listUsers);

module.exports = router;