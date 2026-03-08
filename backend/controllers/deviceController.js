const { getDeviceHealth, getAllDevicesHealth } = require('../services/deviceHealthService');

async function deviceHealth(req, res, next) {
  try {
    const deviceId = req.params.deviceId;
    const result = getDeviceHealth(deviceId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function allDevicesHealth(req, res, next) {
  try {
    const results = getAllDevicesHealth();
    res.status(200).json({
      success: true,
      devices: results
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { deviceHealth, allDevicesHealth };

