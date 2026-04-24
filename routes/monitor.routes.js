const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitor.controller');

router.post('/', monitorController.monitor);

module.exports = router;