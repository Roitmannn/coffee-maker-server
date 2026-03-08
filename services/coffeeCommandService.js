const { env } = require('../config/env');
const { ensureDeviceState } = require('./deviceStore');
const { generateCommandId } = require('../utils/ids');
const { addSeconds, nowMs, toIso } = require('../utils/time');
const { createHttpError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const HISTORY_LIMIT = 10;
const ALLOWED_ACTIONS = new Set(['brew', 'press', 'sequence']);

function capHistory(device) {
  if (!Array.isArray(device.history)) device.history = [];
  if (device.history.length > HISTORY_LIMIT) {
    device.history = device.history.slice(device.history.length - HISTORY_LIMIT);
  }
}

function moveToHistory(device, command) {
  device.history.push(command);
  capHistory(device);
}

function expireIfNeeded(device, now) {
  const cmd = device.currentCommand;
  if (!cmd) return null;
  if (cmd.pending !== true) return null;

  const expiresAt = new Date(cmd.expires_at).getTime();
  if (Number.isNaN(expiresAt)) return null;

  if (now > expiresAt) {
    const expired = {
      ...cmd,
      pending: false,
      status: 'expired',
      acknowledged_at: null
    };

    device.currentCommand = null;
    moveToHistory(device, expired);
    logger.info('command_expired', { device_id: device.deviceId, command_id: cmd.command_id });
    return expired;
  }

  return null;
}

function refreshDeviceCommandState(deviceId) {
  if (!deviceId) return { expired: null };
  const now = nowMs();
  const device = ensureDeviceState(deviceId);
  const expired = expireIfNeeded(device, now);
  return { expired };
}

function validateSteps(steps) {
  if (steps === undefined || steps === null) return null;
  if (!Array.isArray(steps)) {
    throw createHttpError(400, 'validation_error', 'steps must be an array');
  }
  for (const [i, step] of steps.entries()) {
    if (!step || typeof step !== 'object') {
      throw createHttpError(400, 'validation_error', `steps[${i}] must be an object`);
    }
    if (step.action && !ALLOWED_ACTIONS.has(step.action)) {
      throw createHttpError(400, 'validation_error', `steps[${i}].action is not supported`);
    }
  }
  return steps;
}

function checkCooldown(device, now) {
  const cooldownMs = env.deviceCooldownSeconds * 1000;
  if (!cooldownMs) return;

  const lastCommandAt = device.lastCommandAt ? new Date(device.lastCommandAt).getTime() : null;
  const lastAckAt = device.lastAckAt ? new Date(device.lastAckAt).getTime() : null;

  const recentCommand = lastCommandAt && now - lastCommandAt < cooldownMs;
  const recentAck = lastAckAt && now - lastAckAt < cooldownMs;

  if (recentCommand || recentAck) {
    throw createHttpError(
      409,
      'cooldown',
      `Device is in cooldown window (${env.deviceCooldownSeconds}s)`
    );
  }
}

async function setCommand(input) {
  const {
    device_id,
    action,
    target,
    duration_ms,
    expires_in_seconds,
    steps
  } = input || {};

  if (!device_id) throw createHttpError(400, 'validation_error', 'device_id is required');

  const resolvedAction = action || 'brew';
  if (!ALLOWED_ACTIONS.has(resolvedAction)) {
    throw createHttpError(400, 'validation_error', 'action is not supported', {
      allowed_actions: Array.from(ALLOWED_ACTIONS)
    });
  }

  const now = nowMs();
  const device = ensureDeviceState(device_id);

  // Keep state fresh when setting a new command
  expireIfNeeded(device, now);

  // Only one pending command per device (v1)
  if (device.currentCommand && device.currentCommand.pending) {
    throw createHttpError(409, 'command_conflict', 'A command is already pending for this device');
  }

  checkCooldown(device, now);

  const expirySeconds =
    Number.isFinite(Number(expires_in_seconds)) && Number(expires_in_seconds) > 0
      ? Number(expires_in_seconds)
      : env.defaultCommandExpirySeconds;

  const createdAt = new Date(now);
  const expiresAt = addSeconds(createdAt, expirySeconds);

  const command = {
    command_id: generateCommandId(),
    device_id,
    pending: true,
    action: resolvedAction,
    target: target || null,
    duration_ms: Number.isFinite(Number(duration_ms)) ? Number(duration_ms) : null,
    steps: resolvedAction === 'sequence' ? validateSteps(steps) || [] : undefined,
    created_at: toIso(createdAt),
    expires_at: toIso(expiresAt),
    acknowledged_at: null,
    status: 'pending'
  };

  device.currentCommand = command;
  device.lastCommandAt = toIso(createdAt);

  logger.info('command_set', {
    device_id,
    command_id: command.command_id,
    action: command.action,
    expires_at: command.expires_at
  });

  return { command, server_time: toIso(now) };
}

async function getNextCommand(deviceId) {
  if (!deviceId) throw createHttpError(400, 'validation_error', 'device_id is required');

  const now = nowMs();
  const device = ensureDeviceState(deviceId);

  expireIfNeeded(device, now);

  const cmd = device.currentCommand;
  if (!cmd || cmd.pending !== true) {
    logger.info('poll_no_pending', { device_id: deviceId });
    return { pending: false, command: null, server_time: toIso(now) };
  }

  logger.info('poll_pending', { device_id: deviceId, command_id: cmd.command_id, action: cmd.action });
  return { pending: true, command: cmd, server_time: toIso(now) };
}

async function acknowledgeCommand(input) {
  const { device_id, command_id, status, message } = input || {};
  if (!device_id) throw createHttpError(400, 'validation_error', 'device_id is required');
  if (!command_id) throw createHttpError(400, 'validation_error', 'command_id is required');

  const now = nowMs();
  const device = ensureDeviceState(device_id);

  expireIfNeeded(device, now);

  const cmd = device.currentCommand;
  if (!cmd) throw createHttpError(404, 'not_found', 'No current command for this device');
  if (cmd.command_id !== command_id) {
    throw createHttpError(409, 'command_mismatch', 'command_id does not match current device command');
  }
  if (cmd.pending !== true) {
    throw createHttpError(409, 'command_not_pending', 'Command is not pending');
  }

  const ackAt = new Date(now);
  const finalStatus = status || 'done';

  const acknowledged = {
    ...cmd,
    pending: false,
    status: finalStatus,
    message: message || null,
    acknowledged_at: toIso(ackAt)
  };

  device.currentCommand = null;
  device.lastAckAt = toIso(ackAt);
  moveToHistory(device, acknowledged);

  logger.info('command_acknowledged', {
    device_id,
    command_id,
    status: finalStatus
  });

  return { command: acknowledged, server_time: toIso(now) };
}

module.exports = {
  setCommand,
  getNextCommand,
  acknowledgeCommand,
  refreshDeviceCommandState
};

