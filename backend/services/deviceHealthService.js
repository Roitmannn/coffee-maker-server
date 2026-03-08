const { env } = require('../config/env');
const { ensureDeviceState, getDeviceState, getAllDeviceStates } = require('./deviceStore');
const { logger } = require('../utils/logger');
const { nowMs, secondsBetweenMs, toIso } = require('../utils/time');

function isConnected(lastSeenAt, thresholdSeconds, now) {
  if (!lastSeenAt) return false;
  const seconds = secondsBetweenMs(now, lastSeenAt);
  return seconds !== null && seconds <= thresholdSeconds;
}

function touchDevice(deviceId, reason) {
  const device = ensureDeviceState(deviceId);
  const now = nowMs();
  const threshold = env.deviceOfflineThresholdSeconds;

  const wasConnected = device.lastConnectionState;
  const connectedNow = true; // being touched implies "seen now"

  device.lastSeenAt = new Date(now).toISOString();
  device.lastConnectionState = connectedNow;

  // Log reconnects: if we previously knew it was offline (or stale) and it talks again.
  if (wasConnected === false) {
    logger.info('device_reconnect', { device_id: deviceId, reason });
  }

  // If state was unknown/null, don’t spam logs; first touch just establishes state.
  return device;
}

function getDeviceHealth(deviceId) {
  const now = nowMs();
  const threshold = env.deviceOfflineThresholdSeconds;
  const device = getDeviceState(deviceId);

  if (!device) {
    return {
      device_id: deviceId,
      connected: false,
      status: 'offline',
      last_seen_at: null,
      seconds_since_last_seen: null,
      disconnect_threshold_seconds: threshold,
      server_time: toIso(now)
    };
  }

  const connected = isConnected(device.lastSeenAt, threshold, now);
  const secondsSince = secondsBetweenMs(now, device.lastSeenAt);

  // Log stale transitions when health is computed (admin dashboards, etc.)
  if (device.lastConnectionState !== null && device.lastConnectionState !== connected) {
    if (connected) logger.info('device_reconnect', { device_id: deviceId, reason: 'health_check' });
    else logger.warn('device_stale', { device_id: deviceId, seconds_since_last_seen: secondsSince });
    device.lastConnectionState = connected;
  } else if (device.lastConnectionState === null) {
    device.lastConnectionState = connected;
  }

  return {
    device_id: deviceId,
    connected,
    status: connected ? 'online' : 'offline',
    last_seen_at: device.lastSeenAt ? device.lastSeenAt : null,
    seconds_since_last_seen: device.lastSeenAt ? secondsSince : null,
    disconnect_threshold_seconds: threshold,
    server_time: toIso(now)
  };
}

function getAllDevicesHealth() {
  const devices = getAllDeviceStates();
  const deviceIds = devices.map((d) => d.deviceId);
  deviceIds.sort();
  return deviceIds.map((id) => getDeviceHealth(id));
}

module.exports = { touchDevice, getDeviceHealth, getAllDevicesHealth };

