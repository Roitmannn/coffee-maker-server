function toIso(date) {
  return date ? new Date(date).toISOString() : null;
}

function nowMs() {
  return Date.now();
}

function secondsBetweenMs(now, then) {
  if (!then) return null;
  const deltaMs = now - new Date(then).getTime();
  return Math.max(0, Math.floor(deltaMs / 1000));
}

function addSeconds(date, seconds) {
  const ms = new Date(date).getTime() + seconds * 1000;
  return new Date(ms);
}

module.exports = { toIso, nowMs, secondsBetweenMs, addSeconds };

