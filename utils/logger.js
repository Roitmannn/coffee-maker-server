const fs = require('fs');
const { env } = require('../config/env');

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: 'unserializable_log_context' });
  }
}

function toFlatContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  const obj = {};
  for (const [k, v] of Object.entries(context)) obj[k] = v;
  return obj;
}

function contextToPretty(context) {
  const ctx = toFlatContext(context);
  if (!ctx) return '';

  const parts = [];
  for (const [k, v] of Object.entries(ctx)) {
    if (v === undefined) continue;
    if (v === null) {
      parts.push(`${k}=null`);
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const str = String(v);
      const needsQuotes = /\s|=/.test(str);
      parts.push(needsQuotes ? `${k}=${safeJson(str)}` : `${k}=${str}`);
      continue;
    }
    parts.push(`${k}=${safeJson(v)}`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level) {
  const configured = env.logLevel in LEVEL_RANK ? env.logLevel : 'info';
  const threshold = LEVEL_RANK[configured];
  const rank = LEVEL_RANK[level] ?? LEVEL_RANK.info;
  return rank <= threshold;
}

let fileStream = null;
let fileStreamInitAttempted = false;

function getFileStream() {
  if (!env.logFile) return null;
  if (fileStream) return fileStream;
  if (fileStreamInitAttempted) return null;
  fileStreamInitAttempted = true;

  try {
    fileStream = fs.createWriteStream(env.logFile, { flags: 'a' });
    return fileStream;
  } catch {
    return null;
  }
}

function emitToConsole(level, line, prettyLine) {
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(prettyLine !== null ? prettyLine : safeJson(line));
}

function emitToFile(line) {
  const stream = getFileStream();
  if (!stream) return;
  try {
    stream.write(`${safeJson(line)}\n`);
  } catch {
    // ignore (logging should never crash the app)
  }
}

function log(level, message, context) {
  if (!shouldLog(level)) return;

  const line = {
    time: nowIso(),
    level,
    message
  };

  const ctx = toFlatContext(context);
  if (ctx) {
    for (const [k, v] of Object.entries(ctx)) line[k] = v;
  }

  const format = env.logFormat === 'json' ? 'json' : 'pretty';
  const prettyLine = format === 'pretty' ? `${line.time} ${String(level).toUpperCase()} ${message}${contextToPretty(ctx)}` : null;

  emitToConsole(level, line, prettyLine);
  emitToFile(line);
}

const logger = {
  debug: (message, context) => log('debug', message, context),
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context)
};

module.exports = { logger };

