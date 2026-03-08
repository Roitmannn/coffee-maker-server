const { toIso, nowMs } = require('../utils/time');

function health(req, res) {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime_seconds: Math.floor(process.uptime()),
    server_time: toIso(nowMs())
  });
}

module.exports = { health };

