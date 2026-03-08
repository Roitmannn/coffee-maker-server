const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const deviceController = require('../controllers/deviceController');

const router = express.Router();

router.get('/devices/health', requireAdmin, deviceController.allDevicesHealth);
router.get('/devices/:deviceId/health', requireAdmin, deviceController.deviceHealth);

module.exports = router;

