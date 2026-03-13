const STORAGE_KEY = 'coffee_admin_token';
const DISCONNECTED_AFTER_SECONDS = 120;

function $(id) {
  return document.getElementById(id);
}

function byIdOrNull(id) {
  return document.getElementById(id) || null;
}

function getToken() {
  return sessionStorage.getItem(STORAGE_KEY) || '';
}

function setToken(token) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function showToast(message) {
  const el = byIdOrNull('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.classList.remove('show'), 2400);
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('x-admin-token', token);

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && data.error && (data.error.message || data.error.code)) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function isoShort(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function statusTag(status) {
  const s = String(status || '').toLowerCase();
  const good = s === 'done' || s === 'ok';
  const bad = s === 'expired' || s === 'error' || s === 'failed';
  const cls = good ? 'tag tag-good' : bad ? 'tag tag-bad' : 'tag';
  return `<span class="${cls}">${escapeHtml(status || '—')}</span>`;
}

function connectionTag(isConnected) {
  return isConnected
    ? '<span class="tag tag-good">connected</span>'
    : '<span class="tag tag-bad">disconnected</span>';
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function deviceIdFromForm() {
  const manualInput = byIdOrNull('deviceManual');
  if (!manualInput) return '';
  const manual = manualInput.value.trim();
  return manual;
}

function renderPending(pendingCommands) {
  const table = byIdOrNull('pendingTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const pendingCount = byIdOrNull('pendingCount');
  if (pendingCount) pendingCount.textContent = String((pendingCommands || []).length);

  for (const cmd of pendingCommands || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(cmd.device_id)}</td>
      <td>${escapeHtml(cmd.command_id)}</td>
      <td>${escapeHtml(cmd.action)}</td>
      <td>${escapeHtml(isoShort(cmd.created_at))}</td>
      <td>${escapeHtml(isoShort(cmd.expires_at))}</td>
      <td>${statusTag(cmd.status)}</td>
    `;
    tbody.appendChild(tr);
  }

  if (!pendingCommands || pendingCommands.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="6" style="color: rgba(255,255,255,0.55); font-family: var(--sans);">
        No pending commands.
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderHistory(history) {
  const table = byIdOrNull('historyTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = (history || []).slice(0, 80);
  const historyCount = $('historyCount');
  if (historyCount) historyCount.textContent = String(history ? history.length : 0);

  for (const cmd of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(cmd.device_id)}</td>
      <td>${escapeHtml(cmd.command_id)}</td>
      <td>${escapeHtml(cmd.action)}</td>
      <td>${statusTag(cmd.status)}</td>
      <td>${escapeHtml(isoShort(cmd.created_at))}</td>
      <td>${escapeHtml(isoShort(cmd.acknowledged_at))}</td>
      <td title="${escapeHtml(cmd.message || '')}">${escapeHtml(cmd.message || '—')}</td>
    `;
    tbody.appendChild(tr);
  }

  if (!history || history.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="7" style="color: rgba(255,255,255,0.55); font-family: var(--sans);">
        No history yet (acknowledged/expired commands will appear here).
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function normalizeHealth(device) {
  const health = (device && device.health) || {};
  const secondsSinceRaw = health.seconds_since_last_seen;
  const secondsSince =
    Number.isFinite(Number(secondsSinceRaw)) && Number(secondsSinceRaw) >= 0
      ? Number(secondsSinceRaw)
      : null;
  const isConnected = secondsSince !== null && secondsSince <= DISCONNECTED_AFTER_SECONDS;
  return {
    deviceId: (device && (device.device_id || device.deviceId)) || 'unknown',
    isConnected,
    lastSeenAt: health.last_seen_at || null,
    secondsSince
  };
}

function renderDeviceHealth(devices) {
  const table = byIdOrNull('healthTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = Array.isArray(devices) ? devices : [];
  const rows = list.map(normalizeHealth).sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  const alive = rows.filter((r) => r.isConnected).length;
  const aliveCount = byIdOrNull('aliveCount');
  if (aliveCount) aliveCount.textContent = `${alive} / ${rows.length} alive`;

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.deviceId)}</td>
      <td>${connectionTag(row.isConnected)}</td>
      <td>${escapeHtml(isoShort(row.lastSeenAt))}</td>
      <td>${row.secondsSince === null ? '—' : escapeHtml(String(row.secondsSince))}</td>
    `;
    tbody.appendChild(tr);
  }

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="4" style="color: rgba(255,255,255,0.55); font-family: var(--sans);">
        No devices yet. A device appears after it sends a poll/ack or gets a command.
      </td>
    `;
    tbody.appendChild(tr);
  }
}

let lastOverview = null;
let pollingTimer = null;
let busy = false;

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const data = await api('/api/admin/overview', { method: 'GET' });
    lastOverview = data;

    const serverTime = byIdOrNull('serverTime');
    if (serverTime) serverTime.textContent = data.server_time ? `server: ${isoShort(data.server_time)}` : '—';
    const makeHint = byIdOrNull('makeHint');
    if (makeHint) makeHint.textContent = 'Ready';

    renderPending(data.pending_commands || []);
    renderDeviceHealth(data.devices || []);
    renderHistory(data.history || []);
  } catch (err) {
    if (err && err.status === 401) {
      const authHint = byIdOrNull('authHint');
      if (authHint) authHint.textContent = 'Invalid token (401). Please try again.';
      showAuthModal(true);
    } else {
      showToast(err.message || 'Refresh failed');
      const makeHint = byIdOrNull('makeHint');
      if (makeHint) makeHint.textContent = err.message || 'Refresh failed';
    }
  } finally {
    busy = false;
  }
}

function showAuthModal(show) {
  const modal = byIdOrNull('authModal');
  if (!modal) return;
  modal.classList.toggle('show', Boolean(show));
}

function startPolling() {
  window.clearInterval(pollingTimer);
  pollingTimer = window.setInterval(refresh, 2000);
}

function stopPolling() {
  window.clearInterval(pollingTimer);
  pollingTimer = null;
}

async function onMakeSubmit(e) {
  e.preventDefault();

  const deviceId = deviceIdFromForm();
  const actionEl = byIdOrNull('actionSelect');
  const action = (actionEl && actionEl.value) || 'brew';
  if (!deviceId) {
    showToast('Please enter a device_id.');
    return;
  }

  const makeHint = byIdOrNull('makeHint');
  if (makeHint) makeHint.textContent = 'Enqueueing...';
  try {
    const result = await api('/api/admin/coffee/make', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, action })
    });
    showToast(`Enqueued ${result.command && result.command.command_id ? result.command.command_id : 'command'}`);
    if (makeHint) makeHint.textContent = 'Enqueued';
    await refresh();
  } catch (err) {
    showToast(err.message || 'Failed to enqueue');
    if (makeHint) makeHint.textContent = err.message || 'Failed to enqueue';
  }
}

function wireUi() {
  const refreshBtn = byIdOrNull('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);

  const clearTokenBtn = byIdOrNull('clearTokenBtn');
  if (clearTokenBtn) {
    clearTokenBtn.addEventListener('click', () => {
      clearToken();
      stopPolling();
      showAuthModal(true);
      showToast('Signed out');
    });
  }

  const makeForm = byIdOrNull('makeForm');
  if (makeForm) makeForm.addEventListener('submit', onMakeSubmit);

  const authForm = byIdOrNull('authForm');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tokenInput = byIdOrNull('tokenInput');
      const token = tokenInput ? tokenInput.value.trim() : '';
      const authHint = byIdOrNull('authHint');
      if (!token) {
        if (authHint) authHint.textContent = 'Please enter a token.';
        return;
      }

      if (authHint) authHint.textContent = 'Checking...';
      setToken(token);
      try {
        await refresh();
        showAuthModal(false);
        showToast('Signed in');
        startPolling();
      } catch {
        // refresh() will handle modal/errors
      }
    });
  }

  const clearHistoryBtn = byIdOrNull('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      await api('/api/admin/history', { method: 'DELETE' });
      await refresh();
      showToast('History cleared');
    });
  }
}

async function init() {
  wireUi();

  if (!getToken()) {
    showAuthModal(true);
    const authHint = byIdOrNull('authHint');
    if (authHint) authHint.textContent = 'Enter ADMIN_TOKEN to continue.';
    return;
  }

  showAuthModal(false);
  await refresh();
  startPolling();
}

init();

