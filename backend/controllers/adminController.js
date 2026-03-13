const coffeeCommandService = require('../services/coffeeCommandService');
const { getAllDeviceStates } = require('../services/deviceStore');
const { getDeviceHealth } = require('../services/deviceHealthService');
const { nowMs, toIso } = require('../utils/time');

function withDeviceId(command, deviceId) {
  if (!command) return null;
  if (command.device_id) return command;
  return { ...command, device_id: deviceId };
}

async function overview(req, res, next) {
  try {
    const now = nowMs();
    const devices = getAllDeviceStates();

    const pending = [];
    const history = [];
    const deviceSummaries = [];

    for (const device of devices) {
      coffeeCommandService.refreshDeviceCommandState(device.deviceId);

      const pendingCmd = device.currentCommand && device.currentCommand.pending ? device.currentCommand : null;
      if (pendingCmd) pending.push(withDeviceId(pendingCmd, device.deviceId));

      if (Array.isArray(device.history)) {
        for (const cmd of device.history) history.push(withDeviceId(cmd, device.deviceId));
      }

      deviceSummaries.push({
        device_id: device.deviceId,
        health: getDeviceHealth(device.deviceId),
        pending_command: pendingCmd ? withDeviceId(pendingCmd, device.deviceId) : null,
        history: (device.history || []).map((c) => withDeviceId(c, device.deviceId))
      });
    }

    pending.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    history.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    res.status(200).json({
      success: true,
      server_time: toIso(now),
      devices: deviceSummaries,
      pending_commands: pending,
      history
    });
  } catch (err) {
    next(err);
  }
}

async function makeCoffee(req, res, next) {
  try {
    const body = req.body || {};
    const deviceId = body.device_id || body.deviceId;
    const action = body.action || 'brew';

    // Defaults that make sense for "Make coffee" button.
    const result = await coffeeCommandService.setCommand({
      device_id: deviceId,
      action,
      target: body.target || 'coffee',
      duration_ms: body.duration_ms,
      expires_in_seconds: body.expires_in_seconds
    });

    res.status(200).json({
      success: true,
      server_time: result.server_time,
      command: result.command
    });
  } catch (err) {
    next(err);
  }
}

async function clearHistory(req, res, next) {
  try {
    const devices = getAllDeviceStates();
    for (const device of devices) {
      device.history = [];
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { overview, makeCoffee, clearHistory };

