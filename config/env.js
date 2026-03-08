const dotenv = require('dotenv');

// Load .env if present (safe in production too; env vars already set will win)
dotenv.config();

function toInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function parseDeviceTokensJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toLowerString(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase();
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  apiKey: process.env.API_KEY || '',
  deviceToken: process.env.DEVICE_TOKEN || '',
  adminToken: process.env.ADMIN_TOKEN || '',

  // Logging
  // - LOG_FORMAT: "pretty" (VM/journalctl friendly) or "json"
  // - LOG_LEVEL: "error" | "warn" | "info" | "debug"
  // - LOG_FILE: optional path to append JSON lines (e.g. /var/log/coffee-maker/server.log)
  logFormat: toLowerString(process.env.LOG_FORMAT, 'pretty'),
  logLevel: toLowerString(process.env.LOG_LEVEL, 'info'),
  logFile: process.env.LOG_FILE || '',

  // Optional JSON map: { "coffee1": "token1", "coffee2": "token2" }
  deviceTokensMap: parseDeviceTokensJson(process.env.DEVICE_TOKENS_JSON),

  defaultCommandExpirySeconds: toInt(process.env.DEFAULT_COMMAND_EXPIRY_SECONDS, 120),
  deviceCooldownSeconds: toInt(process.env.DEVICE_COOLDOWN_SECONDS, 10),

  deviceOfflineThresholdSeconds: toInt(process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS, 20),

  enableDebugState: toBool(process.env.ENABLE_DEBUG_STATE, false)
};

module.exports = { env };

