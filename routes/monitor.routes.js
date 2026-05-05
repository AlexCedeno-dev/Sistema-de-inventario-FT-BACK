const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitor.controller');

router.post('/', monitorController.monitor);
router.post('/location', monitorController.location);

module.exports = router;