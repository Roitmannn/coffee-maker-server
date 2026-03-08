const { env } = require('../config/env');
const { getDeviceMap } = require('../services/deviceStore');
const { toIso, nowMs } = require('../utils/time');

function debugState(req, res) {
  if (!env.enableDebugState) {
    return res.status(404).json({
      success: false,
      error: { code: 'not_found', message: 'Debug endpoint disabled' }
    });
  }

  // Map -> plain object for JSON
  const obj = {};
  for (const [deviceId, state] of getDeviceMap().entries()) {
    obj[deviceId] = state;
  }

  res.status(200).json({
    success: true,
    server_time: toIso(nowMs()),
    devices: obj
  });
}

module.exports = { debugState };

