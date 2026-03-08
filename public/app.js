const STORAGE_KEY = 'coffee_admin_token';

function $(id) {
  return document.getElementById(id);
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
  const el = $('toast');
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

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function deviceIdFromForm(overview) {
  const manual = $('deviceManual').value.trim();
  if (manual) return manual;

  const selected = $('deviceSelect').value;
  if (selected) return selected;

  // If no devices exist yet, user must type it.
  const fallback =
    (overview &&
      overview.devices &&
      overview.devices[0] &&
      (overview.devices[0].device_id || overview.devices[0].deviceId)) ||
    '';
  return fallback;
}

function renderDeviceSelect(overview) {
  const select = $('deviceSelect');
  const devices = (overview && overview.devices) || [];
  const ids = devices.map((d) => d.device_id).filter(Boolean);
  ids.sort();

  select.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = ids.length ? 'Select device…' : 'No devices yet';
  select.appendChild(opt0);

  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    select.appendChild(opt);
  }
}

function renderPending(pendingCommands) {
  const tbody = $('pendingTable').querySelector('tbody');
  tbody.innerHTML = '';

  $('pendingCount').textContent = String((pendingCommands || []).length);

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
  const tbody = $('historyTable').querySelector('tbody');
  tbody.innerHTML = '';

  const list = (history || []).slice(0, 80);
  $('historyCount').textContent = String(history ? history.length : 0);

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

let lastOverview = null;
let pollingTimer = null;
let busy = false;

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const data = await api('/api/admin/overview', { method: 'GET' });
    lastOverview = data;

    $('serverTime').textContent = data.server_time ? `server: ${isoShort(data.server_time)}` : '—';
    $('makeHint').textContent = 'Ready';

    renderDeviceSelect(data);
    renderPending(data.pending_commands || []);
    renderHistory(data.history || []);
  } catch (err) {
    if (err && err.status === 401) {
      $('authHint').textContent = 'Invalid token (401). Please try again.';
      showAuthModal(true);
    } else {
      showToast(err.message || 'Refresh failed');
      $('makeHint').textContent = err.message || 'Refresh failed';
    }
  } finally {
    busy = false;
  }
}

function showAuthModal(show) {
  const modal = $('authModal');
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

  const deviceId = deviceIdFromForm(lastOverview);
  const action = $('actionSelect').value || 'brew';
  if (!deviceId) {
    showToast('Please enter a device_id.');
    return;
  }

  $('makeHint').textContent = 'Enqueueing…';
  try {
    const result = await api('/api/admin/coffee/make', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, action })
    });
    showToast(`Enqueued ${result.command && result.command.command_id ? result.command.command_id : 'command'}`);
    $('makeHint').textContent = 'Enqueued';
    await refresh();
  } catch (err) {
    showToast(err.message || 'Failed to enqueue');
    $('makeHint').textContent = err.message || 'Failed to enqueue';
  }
}

function wireUi() {
  $('refreshBtn').addEventListener('click', refresh);
  $('clearTokenBtn').addEventListener('click', () => {
    clearToken();
    stopPolling();
    showAuthModal(true);
    showToast('Signed out');
  });

  $('makeForm').addEventListener('submit', onMakeSubmit);

  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('tokenInput').value.trim();
    if (!token) {
      $('authHint').textContent = 'Please enter a token.';
      return;
    }

    $('authHint').textContent = 'Checking…';
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

async function init() {
  wireUi();

  if (!getToken()) {
    showAuthModal(true);
    $('authHint').textContent = 'Enter ADMIN_TOKEN to continue.';
    return;
  }

  showAuthModal(false);
  await refresh();
  startPolling();
}

init();

