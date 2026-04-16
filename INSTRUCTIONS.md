# DeployFlow — Setup & Configuration Instructions

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Production Setup](#docker-production-setup)
4. [Environment Variables](#environment-variables)
5. [Database Management](#database-management)
6. [Email Configuration](#email-configuration)
7. [Authentication](#authentication)
8. [Scheduler](#scheduler)
9. [Frontend Configuration](#frontend-configuration)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Development

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 16+
- **Redis** 7+
- **npm** 10+

### Docker

- **Docker** 24+
- **Docker Compose** v2+

---

## Local Development Setup

### 1. Install Dependencies

```bash
# Backend
cd backend && npm install

# Worker
cd ../worker && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

Copy example files and customize:

```bash
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
```

At minimum, set these values in **both** `.env` files:

| Variable         | Description                        | Example                                                       |
|------------------|------------------------------------|---------------------------------------------------------------|
| `DATABASE_URL`   | PostgreSQL connection string       | `postgresql://deployflow:deployflow@localhost:5436/deployflow` |
| `REDIS_HOST`     | Redis hostname                     | `localhost`                                                   |
| `REDIS_PORT`     | Redis port                         | `6381`                                                        |
| `ACK_TOKEN_SECRET` | HMAC signing key for ack tokens  | Any random string (32+ chars recommended)                     |

Backend-only:

| Variable     | Description            | Example                        |
|--------------|------------------------|--------------------------------|
| `JWT_SECRET` | JWT signing key        | Any random string (32+ chars)  |
| `API_PORT`   | Express server port    | `3001`                         |

### 3. Set Up Database

Ensure PostgreSQL is running, then:

```bash
cd backend

# Run migrations (creates tables)
npx prisma migrate dev

# Optional: seed sample data (3 tasks with dependencies)
npm run db:seed

# Optional: regenerate Prisma client after schema changes
npx prisma generate
```

### 4. Start Services

Open three terminal windows:

```bash
# Terminal 1 — Backend API (includes scheduler)
cd backend && npm run dev

# Terminal 2 — Worker (processes task + email queues)
cd worker && npm run dev

# Terminal 3 — Frontend (React dev server)
cd frontend && npm start
```

Services will be available at:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001
- **Health check:** http://localhost:3001/health

---

## Docker Production Setup

### 1. Configure Environment

```bash
cd docker
cp .env.example .env
```

Edit `docker/.env` with production values:

```env
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<strong-random-secret>
ACK_TOKEN_SECRET=<strong-random-secret>
FRONTEND_URL=https://your-domain.com
```

### 2. Build and Start

```bash
docker compose up --build -d
```

This starts five services:
- **postgres** — PostgreSQL 16 (port 5438 on host)
- **redis** — Redis 7 with AOF persistence (port 6383 on host)
- **api** — Express API with auto-migration on startup (port 3003 on host)
- **worker** — BullMQ processor (no exposed port)
- **frontend** — Nginx serving React build with API proxy (port 3004 on host)

### 3. Verify

```bash
# Check service health
docker compose ps

# Check API health
curl http://localhost:3003/health

# Check frontend
curl http://localhost:3004/

# View logs
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f frontend
```

### 4. Seed Database (Optional)

```bash
docker compose exec api npx prisma db seed
```

### Docker Service Details

| Service  | Image            | Health Check                    | Depends On       | Restart Policy   |
|----------|------------------|---------------------------------|------------------|------------------|
| postgres | postgres:16-alpine | `pg_isready` every 5s          | —                | unless-stopped   |
| redis    | redis:7-alpine   | `redis-cli ping` every 5s       | —                | unless-stopped   |
| api      | Custom (Node 20) | `wget /health` every 10s        | postgres, redis  | unless-stopped   |
| worker   | Custom (Node 20) | —                                | postgres, redis  | unless-stopped   |
| frontend | Custom (Nginx)   | —                                | api              | unless-stopped   |

The API service automatically runs `prisma migrate deploy` on startup via the entrypoint script.

### Docker Networking

Inside the Docker network, services reference each other by name:
- PostgreSQL: `postgres:5432`
- Redis: `redis:6379`
- API: `api:3001` (used by Nginx proxy)

The `docker-compose.yml` sets these automatically — do **not** use `localhost` in Docker env vars.

### Nginx Configuration

The frontend Nginx server:
- Serves the React build as a SPA (`try_files $uri $uri/ /index.html`)
- Proxies `/api/` requests to the backend API (`http://api:3001/api/`)
- Enables **gzip compression** for JS, CSS, JSON (reduces ~1.1MB JS to ~300KB)
- Config file: `docker/nginx/nginx.conf`

---

## Environment Variables

### Complete Reference

| Variable             | Used By        | Required | Default                      | Description                           |
|----------------------|----------------|----------|------------------------------|---------------------------------------|
| `DATABASE_URL`       | backend, worker | Yes      | —                            | PostgreSQL connection string          |
| `REDIS_HOST`         | backend, worker | No       | `localhost`                  | Redis hostname                        |
| `REDIS_PORT`         | backend, worker | No       | `6379`                       | Redis port                            |
| `JWT_SECRET`         | backend        | Yes      | —                            | JWT token signing key                 |
| `ACK_TOKEN_SECRET`   | backend, worker | Yes      | `dev-ack-secret-...`         | HMAC-SHA256 signing key for ack tokens|
| `API_PORT`           | backend        | No       | `3001`                       | Express server port                   |
| `FRONTEND_URL`       | backend, worker | No       | `http://localhost:3000`      | Used in acknowledgement email links   |
| `SMTP_HOST`          | worker         | No       | —                            | SMTP server hostname                  |
| `SMTP_PORT`          | worker         | No       | `587`                        | SMTP server port                      |
| `SMTP_USER`          | worker         | No       | —                            | SMTP authentication username          |
| `SMTP_PASS`          | worker         | No       | —                            | SMTP authentication password          |
| `ACK_TOKEN_EXPIRY_MS`| worker         | No       | `604800000` (7 days)         | Ack token expiry in milliseconds      |
| `NODE_ENV`           | all            | No       | `development`                | Environment mode                      |

### Docker-Only Variables

| Variable           | Default       | Description                     |
|--------------------|---------------|---------------------------------|
| `POSTGRES_USER`    | `deployflow`  | PostgreSQL username             |
| `POSTGRES_PASSWORD`| — (required)  | PostgreSQL password             |
| `POSTGRES_DB`      | `deployflow`  | PostgreSQL database name        |
| `POSTGRES_PORT`    | `5438`        | Host-mapped PostgreSQL port     |
| `REDIS_PORT`       | `6383`        | Host-mapped Redis port          |
| `API_PORT`         | `3003`        | Host-mapped API port            |
| `FRONTEND_PORT`    | `3004`        | Host-mapped frontend port       |
| `FRONTEND_URL`     | `http://localhost:3004` | Used in email links    |

---

## Database Management

### Prisma Commands

```bash
cd backend

# Create a new migration after schema changes
npx prisma migrate dev --name <migration-name>

# Apply pending migrations (production)
npx prisma migrate deploy

# Reset database (drops all data)
npx prisma migrate reset

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Regenerate client after schema changes
npx prisma generate

# Seed sample data
npm run db:seed
```

### Schema Location

The Prisma schema is at `backend/prisma/schema.prisma`. The worker service copies this schema during Docker build to generate its own Prisma client.

The schema includes `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` for Docker Alpine compatibility.

### Models

- **User** — Authentication accounts (email, password, name, role)
- **Task** — Deployment tasks with status lifecycle
- **TaskDependency** — Many-to-many dependency relationships between tasks
- **AuditLog** — Immutable log of all task changes

---

## Email Configuration

### Mock Mode (Default)

When `SMTP_HOST` and `SMTP_USER` are empty, the worker uses Nodemailer's JSON transport. Emails are logged to the console instead of being sent. This is the default for development.

### Real SMTP

Set these in the worker's `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key
```

### Email Content

Triggered task emails include:
- Task name, system, team, and description
- Planned start/end times
- A clickable **Acknowledge Task** button with a signed URL
- A fallback plain-text URL for copy/paste

---

## Authentication

### JWT Flow

1. **Register:** `POST /api/auth/register` with `{ email, password, name }`
2. **Login:** `POST /api/auth/login` with `{ email, password }`
3. Both return `{ token, user }` — store the token
4. Include `Authorization: Bearer <token>` on all `/api/tasks/*` requests
5. Tokens expire after 24 hours

### Frontend Auth

The frontend stores the JWT in `localStorage.token`. The Axios interceptor automatically attaches it to all requests. A **401 response interceptor** clears the expired token and redirects to `/#/login`.

The `ProtectedRoute` component redirects to `/login` if no token is present.

### Public Endpoints

These do **not** require JWT:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/acknowledge` (protected by HMAC-signed token instead)
- `GET /health`

---

## Scheduler

The scheduler runs inside the API process on a 60-second interval.

### What It Does

1. **Unblock phase:** Checks all `Blocked` tasks — if dependencies are now complete, transitions them back to `Pending`
2. **Queue phase:** Finds all `Pending` tasks where `plannedStartTime <= now` — if dependencies are met, enqueues them to the task queue; otherwise marks them `Blocked`

### Manual Trigger

For testing, trigger the scheduler immediately:

```bash
# Local
curl -X POST http://localhost:3001/api/scheduler/trigger

# Docker
curl -X POST http://localhost:3003/api/scheduler/trigger
```

### Check Status

```bash
curl http://localhost:3003/api/scheduler/status
```

Returns: `{ lastRunAt, lastRunDurationMs, tasksEnqueued, tasksBlocked, tasksUnblocked, errors, running }`

---

## Frontend Configuration

### Routing

The frontend uses **HashRouter** for compatibility with reverse proxies and VS Code port forwarding. URLs use hash fragments:
- `http://localhost:3004/#/` — Dashboard
- `http://localhost:3004/#/tasks` — Task Grid
- `http://localhost:3004/#/login` — Login

### Pages

- **Dashboard** (`/`) — Overview cards showing task counts by status (Pending, Triggered, Acknowledged, Completed, Blocked) and a recent tasks table
- **Tasks** (`/tasks`) — AG Grid Excel-like editor with Add Task, Delete Selected, and inline cell editing
- **Login** (`/login`) — Email/password login form
- **Acknowledge** (`/acknowledge`) — Public page for email acknowledgement links

### Layout

- **Sidebar** — Dark navigation panel with Dashboard and Tasks links, plus Logout button
- **Header** — Shows current page title and logged-in user email

### Environment

Create `frontend/.env` (optional for local development):

```env
REACT_APP_API_URL=http://localhost:3001/api
```

For Docker, the API URL is set via build arg in `docker-compose.yml`:

```yaml
args:
  REACT_APP_API_URL: ./api
```

The `./api` relative path ensures API calls work through any proxy (VS Code port forwarding, Nginx, etc.).

### AG Grid

The frontend uses AG Grid Community (free). No license key is needed. The grid supports:
- Inline cell editing (double-click or start typing)
- Status dropdown with color-coded badges
- Multi-select dependency picker with search
- Date/time pickers for planned start/end
- Keyboard navigation (Tab, Enter, Escape)

### Editing Rules

- **Completed tasks** cannot be edited (enforced in UI and backend)
- **actualStartTime / actualEndTime** are read-only (set by system)
- Changes are debounced per-row (400ms) before sending to the API
- On update failure, the grid refetches all tasks to resync

---

## Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5438`
- Check `DATABASE_URL` matches your PostgreSQL credentials
- In Docker: ensure `postgres` service is healthy (`docker compose ps`)

**"Cannot connect to Redis"**
- Verify Redis is running: `redis-cli -h localhost -p 6383 ping`
- Check `REDIS_HOST` and `REDIS_PORT` in `.env`

**"Invalid or expired token" on API calls**
- JWT tokens expire after 24 hours — log in again
- The frontend auto-redirects to login on 401 responses
- Ensure `JWT_SECRET` is the same value across restarts

**Emails not sending**
- Check worker logs: `docker compose logs -f worker`
- With mock transport, emails are logged to stdout (not sent)
- Verify SMTP credentials if using real SMTP

**Scheduler not triggering tasks**
- Tasks need `plannedStartTime` set to a past or current time
- Task must be in `Pending` status
- All dependencies must be `Completed`
- Check scheduler status: `curl http://localhost:3003/api/scheduler/status`

**"Circular dependency detected"**
- You're trying to create a dependency cycle (A depends on B depends on A)
- Remove the conflicting dependency before adding the new one

**Docker build fails**
- Ensure `.dockerignore` is present (prevents copying `node_modules`)
- Run `docker compose build --no-cache` for a clean rebuild
- If Prisma fails: check that `binaryTargets` includes `linux-musl-openssl-3.0.x` in `schema.prisma`

**Port conflicts**
- Default Docker ports: Frontend=3004, API=3003, PostgreSQL=5438, Redis=6383
- Change via `docker/.env` variables (`FRONTEND_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`)

**Blank page in VS Code port forwarding**
- The frontend uses HashRouter specifically for VS Code proxy compatibility
- Ensure you access via the forwarded URL (e.g., `https://host:port/proxy/3004/`)
- Hard refresh (Ctrl+Shift+R) after rebuilds to clear cached assets

**PostgreSQL auth failure after port/password change**
- Remove old volumes: `docker compose down -v` (deletes all data)
- Then rebuild: `docker compose up --build -d`
