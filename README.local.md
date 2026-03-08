## Local dev quick start

### Option A: run backend directly (no Docker)

```bash
cd backend
npm install
npm start
```

- API: `http://localhost:3000/api/health`
- UI: serve `frontend/` with any static server and use the same host’s `/api/*`

### Option B: Docker Compose dev (Nginx on 8080)

```bash
docker compose -f infra/docker-compose.dev.yml up --build
```

- UI: `http://localhost:8080/`
- API direct: `http://localhost:3000/api/health`

