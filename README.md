# Coffee Automation Polling Server (v1)

Small, production-minded **Node.js + Express** server for coffee automation with an ESP32.

## What it does

- **External automation** (IFTTT / iPhone Shortcut / webhook) calls `POST /api/coffee/set` to create a **pending command** for a device.
- **ESP32 polls** `GET /api/coffee/next` every few seconds to fetch the **current pending command** (read-only; not consumed on read).
- After executing locally (relay pulse, etc.), the ESP32 calls `POST /api/coffee/ack` to **acknowledge** completion.
- Server stores everything **in memory** (v1) and supports **multiple devices** via `device_id`.
- Tracks **device heartbeat** from `next` + `ack` calls and exposes **admin-only device health** endpoints.

## Folder structure

```
coffee-maker/
  app.js
  server.js
  package.json
  .env.example
  README.md
  config/
    env.js
  controllers/
    coffeeController.js
    debugController.js
    deviceController.js
    healthController.js
  middleware/
    auth.js
    errorHandler.js
    requestLogger.js
  routes/
    coffeeRoutes.js
    debugRoutes.js
    deviceRoutes.js
    healthRoutes.js
  services/
    coffeeCommandService.js
    deviceHealthService.js
    deviceStore.js
  utils/
    errors.js
    ids.js
    logger.js
    time.js
```

## Setup

### Prereqs

- Node.js 18+ recommended

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in secrets:

- `API_KEY`: used by webhook/admin-like callers for `set` and `ack`
- `DEVICE_TOKEN`: used by ESP32 polling `next`
- `ADMIN_TOKEN`: used for admin endpoints (device health, debug state)

### Run locally

```bash
npm start
```

Dev mode with auto-reload:

```bash
npm run dev
```

## Environment variables

- **PORT**: server port (default `3000`)
- **API_KEY**: shared secret for `POST /api/coffee/set` and `POST /api/coffee/ack`
- **DEVICE_TOKEN**: shared secret for `GET /api/coffee/next?token=...`
- **ADMIN_TOKEN**: shared secret for admin endpoints
- **DEFAULT_COMMAND_EXPIRY_SECONDS**: default command expiry (default `120`)
- **DEVICE_COOLDOWN_SECONDS**: block rapid re-issuing of commands per device (default `10`)
- **DEVICE_OFFLINE_THRESHOLD_SECONDS**: device is offline if not seen within this window (default `20`)
- **DEVICE_TOKENS_JSON** (optional): JSON map of per-device tokens, e.g. `{"coffee1":"t1","coffee2":"t2"}`
- **ENABLE_DEBUG_STATE** (optional): enable `GET /api/debug/state` (default `false`)

## API

All requests/responses are JSON.

### 1) Create command (webhook)

`POST /api/coffee/set`

Auth:
- header `x-api-key: <API_KEY>`

Body fields:
- `device_id` (required)
- `action` (optional, default `"brew"`) — allowed: `brew`, `press`, `sequence`
- `target` (optional, e.g. `"brew_button"`)
- `duration_ms` (optional, e.g. `200`)
- `expires_in_seconds` (optional, default `DEFAULT_COMMAND_EXPIRY_SECONDS`)
- `steps` (optional, only for `sequence`) — array of step objects

Cooldown rules:
- One pending command per device at a time (v1)
- Cooldown blocks a new command if a command was **recently created** or **recently acknowledged** within `DEVICE_COOLDOWN_SECONDS`

Example:

```bash
curl -X POST "http://localhost:3000/api/coffee/set" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: $env:API_KEY" ^
  -d "{\"device_id\":\"coffee1\",\"action\":\"press\",\"target\":\"brew_button\",\"duration_ms\":200,\"expires_in_seconds\":120}"
```

### 2) Poll next command (ESP32)

`GET /api/coffee/next?device_id=...&token=...`

Auth:
- query param `token=<DEVICE_TOKEN>` (or per-device token if `DEVICE_TOKENS_JSON` is set)

Notes:
- **Does not consume** the command on read (v1 behavior).
- Updates `lastSeenAt` heartbeat for the device.

Example:

```bash
curl "http://localhost:3000/api/coffee/next?device_id=coffee1&token=$env:DEVICE_TOKEN"
```

### 3) Acknowledge command completion (ESP32)

`POST /api/coffee/ack`

Auth:
- header `x-api-key: <API_KEY>`

Body:
- `device_id` (required)
- `command_id` (required)
- `status` (optional, default `"done"`)
- `message` (optional)

Notes:
- Updates `lastSeenAt` heartbeat for the device.
- Moves acknowledged commands into a small per-device history (last 10).

Example:

```bash
curl -X POST "http://localhost:3000/api/coffee/ack" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: $env:API_KEY" ^
  -d "{\"device_id\":\"coffee1\",\"command_id\":\"cmd_123\",\"status\":\"done\",\"message\":\"Relay pulse sent successfully\"}"
```

### 4) Health check (deploy platforms)

`GET /api/health`

Example:

```bash
curl "http://localhost:3000/api/health"
```

### 5) (Optional) Debug state (admin)

`GET /api/debug/state`

Auth:
- header `x-admin-token: <ADMIN_TOKEN>` (or `x-api-key` equal to `ADMIN_TOKEN`)

Enable it:
- set `ENABLE_DEBUG_STATE=true`

Example:

```bash
curl "http://localhost:3000/api/debug/state" -H "x-admin-token: $env:ADMIN_TOKEN"
```

## Device heartbeat & health (admin)

Heartbeats are tracked **in memory**:
- `lastSeenAt` is updated when a device calls:
  - `GET /api/coffee/next`
  - `POST /api/coffee/ack`

A device is:
- **online** if seen within `DEVICE_OFFLINE_THRESHOLD_SECONDS`
- **offline** otherwise (or never seen)

### 1) Health for one device

`GET /api/devices/:deviceId/health`

Auth:
- header `x-admin-token: <ADMIN_TOKEN>`

Example:

```bash
curl "http://localhost:3000/api/devices/coffee1/health" -H "x-admin-token: $env:ADMIN_TOKEN"
```

### 2) Health for all devices

`GET /api/devices/health`

Example:

```bash
curl "http://localhost:3000/api/devices/health" -H "x-admin-token: $env:ADMIN_TOKEN"
```

Response fields include:
- `device_id`
- `connected` (boolean)
- `status` (`online` / `offline`)
- `last_seen_at` (ISO string or `null`)
- `seconds_since_last_seen` (number or `null`)
- `disconnect_threshold_seconds`
- `server_time`

## ESP32 polling loop example (high level)

Pseudo-flow:

1. Poll `GET /api/coffee/next?device_id=...&token=...`
2. If `pending` is `true`, read `command.action/target/duration_ms`
3. Trigger relay pulse / sequence locally
4. Ack `POST /api/coffee/ack` with `device_id` + `command_id`
5. Continue polling

The important v1 detail: **polling does not consume** the command, so if the device reboots mid-action, it can re-fetch the same pending command until it is acknowledged or expires.

## Logging

Logs default to **VM-friendly pretty one-line output** to stdout:
- `http_request`
- `command_set`
- `poll_no_pending` / `poll_pending`
- `command_expired`
- `command_acknowledged`
- auth failures
- `device_reconnect` / `device_stale` (as health is computed)

You can switch back to JSON logs and/or also write JSON logs to a file:

- `LOG_FORMAT=pretty` (default) or `LOG_FORMAT=json`
- `LOG_LEVEL=info` (default) or `LOG_LEVEL=debug|warn|error`
- `LOG_FILE=/path/to/server.log` (optional; appends JSON lines, good for `tail -f`)

This works well with a VM + systemd (`journalctl -u ...`) and also keeps a tail-able audit-lite file if you want it.

## Admin UI (dashboard)

This server now ships with a small admin UI served from the same process.

- **URL**: open `/` in your browser (e.g. `http://<server>:3000/`)
- **Auth**: enter your `ADMIN_TOKEN` when prompted (stored in browser session only)

What it shows:
- **Command history** (acknowledged/expired)
- **Pending commands**
- **“Make coffee” button** that enqueues a pending command (simulated client)

Admin API endpoints (same token):
- `GET /api/admin/overview` (header `x-admin-token: <ADMIN_TOKEN>`)
- `POST /api/admin/coffee/make` (header `x-admin-token: <ADMIN_TOKEN>`)
  - body: `{ "device_id": "coffee1", "action": "brew" }`

## Deployment notes (DigitalOcean App Platform)

- Add this repo as an app from GitHub.
- Set build/run commands:
  - Build: `npm install`
  - Run: `npm start`
- Set environment variables in App Platform (don’t commit `.env`).
- Ensure the service listens on `PORT` (this app does).
- This server is stateless **except for in-memory state**; see limitations below.

## Limitations (in-memory v1)

- **No persistence**: restarting the server clears pending commands and device heartbeats.
- **Single instance**: if you run multiple instances, state is not shared between them.
- **No durable audit log**: history is best-effort and kept in memory only.

## Future upgrades

- Redis persistence (command storage + device heartbeat shared across instances)
- Per-device tokens (already supported via `DEVICE_TOKENS_JSON`, extend to UI-managed provisioning)
- Rate limiting (protect webhook and polling routes)
- HTTPS-only + stricter auth (HMAC signatures, rotating keys)
- Command queue per device instead of single pending command (FIFO with ack-by-id)
- Audit logs (append-only storage, exportable)

