const coffeeCommandService = require('../services/coffeeCommandService');
const { touchDevice } = require('../services/deviceHealthService');

async function setCoffeeCommand(req, res, next) {
  try {
    const result = await coffeeCommandService.setCommand(req.body);
    res.status(200).json({
      success: true,
      server_time: result.server_time,
      command: result.command
    });
  } catch (err) {
    next(err);
  }
}

async function getNextCoffeeCommand(req, res, next) {
  try {
    const deviceId = req.query.device_id;
    touchDevice(deviceId, 'poll_next');

    const result = await coffeeCommandService.getNextCommand(deviceId);
    res.status(200).json({
      success: true,
      server_time: result.server_time,
      pending: result.pending,
      command: result.command
    });
  } catch (err) {
    next(err);
  }
}

async function acknowledgeCoffeeCommand(req, res, next) {
  try {
    const deviceId = req.body && req.body.device_id;
    if (deviceId) touchDevice(deviceId, 'ack');

    const result = await coffeeCommandService.acknowledgeCommand(req.body);
    res.status(200).json({
      success: true,
      server_time: result.server_time,
      command: result.command
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  setCoffeeCommand,
  getNextCoffeeCommand,
  acknowledgeCoffeeCommand
};

