const { env } = require('../config/env');
const { createHttpError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function requireApiKey(req, _res, next) {
  const key = req.header('x-api-key');
  console.log('env', env);
  console.log('key', key);
  if (!env.apiKey || key !== env.apiKey) {
    logger.warn('auth_failure_api_key', { path: req.originalUrl, ip: req.ip });
    return next(createHttpError(401, 'unauthorized', 'Invalid API key'));
  }
  next();
}

function requireAdmin(req, _res, next) {
  const token = req.header('x-admin-token') || req.header('x-api-key');
  console.log('env', env);

  if (!env.adminToken || token !== env.adminToken) {
    logger.warn('auth_failure_admin', { path: req.originalUrl, ip: req.ip });
    return next(createHttpError(401, 'unauthorized', 'Invalid admin token'));
  }
  next();
}

function deviceTokenFor(deviceId) {
  if (env.deviceTokensMap && env.deviceTokensMap[deviceId]) return env.deviceTokensMap[deviceId];
  return env.deviceToken || '';
}

function requireDeviceToken(req, _res, next) {
  const deviceId = req.query.device_id;
  const token = req.query.token || req.header('x-device-token') || '';

  if (!deviceId) return next(createHttpError(400, 'validation_error', 'device_id is required'));

  const expected = deviceTokenFor(deviceId);
  if (!expected || token !== expected) {
    logger.warn('auth_failure_device_token', {
      device_id: deviceId,
      path: req.originalUrl,
      ip: req.ip
    });
    return next(createHttpError(401, 'unauthorized', 'Invalid device token'));
  }

  next();
}

module.exports = { requireApiKey, requireAdmin, requireDeviceToken, deviceTokenFor };

