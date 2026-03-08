// Central in-memory state (v1).
// Later you can replace this module with Redis or a DB adapter with minimal changes.

const deviceMap = new Map(); // device_id -> deviceState

function ensureDeviceState(deviceId) {
  if (!deviceMap.has(deviceId)) {
    deviceMap.set(deviceId, {
      deviceId,
      currentCommand: null,
      lastCommandAt: null,
      lastAckAt: null,

      // Heartbeat
      lastSeenAt: null,
      lastConnectionState: null, // boolean or null (unknown)

      // Small capped history for debugging / audit-lite
      history: []
    });
  }
  return deviceMap.get(deviceId);
}

function getDeviceState(deviceId) {
  return deviceMap.get(deviceId) || null;
}

function getAllDeviceStates() {
  return Array.from(deviceMap.values());
}

function getDeviceMap() {
  // Only for debug endpoints.
  return deviceMap;
}

module.exports = {
  ensureDeviceState,
  getDeviceState,
  getAllDeviceStates,
  getDeviceMap
};

