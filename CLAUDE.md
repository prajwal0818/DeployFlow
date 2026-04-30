# DeployFlow — AI Agent Instructions

## Project Overview
DeployFlow is a deployment task orchestration system replacing Excel-based tracking with an automated, event-driven platform. Multi-project task management, AG Grid editing, dashboard with pie chart, scheduling, email notifications, audit trail, Docker deployment.

## Architecture
```
Frontend (React + AG Grid + Nginx) → Backend API (Express + Prisma) → PostgreSQL + Redis → BullMQ → Worker (Email + Tasks)
```
Five services: `frontend`, `api`, `worker`, `postgres`, `redis`.

**Tech Stack:** React 18, AG Grid 32, TailwindCSS, HashRouter | Node 20, Express 4, Prisma 5, Zod, JWT, Pino | BullMQ 5, Nodemailer | PostgreSQL 16, Redis 7 | Docker, Nginx

## Project Structure
```
backend/   server.js, prisma/schema.prisma, prisma/seed.js
  src/     app.js, config/, controllers/, routes/, middleware/, services/, validators/, utils/
worker/    index.js, src/processors/, src/queues/, src/services/, src/config/
frontend/  src/App.jsx, components/{auth,landing,dashboard,grid,projects,acknowledge,layout,profile}/
  src/     hooks/useTaskData, services/api.js, utils/constants.js
docker/    docker-compose.yml, *.Dockerfile, api-entrypoint.sh, nginx/nginx.conf, .env
```

## Data Model
- **User** — id, email, password, name, role
- **Project** — id, name, code (unique), description
- **Task** — id, system, taskName, description, assignedTeam, assignedUserId, plannedStartTime, plannedEndTime, actualStartTime, actualEndTime, status, notes, projectId, sequenceNumber
- **TaskDependency** — taskId, dependsOnTaskId (unique pair)
- **AuditLog** — taskId, action, field, oldValue, newValue, userId

**Project-Task rules:** projectId required & immutable after creation. sequenceNumber auto-increments per project via transaction. Display ID = `project.code-sequenceNumber` (e.g. `Q3-PROD-1`). Cross-project dependencies forbidden.

## Task Statuses & Transitions
`Pending → Triggered → Acknowledged → Completed` (immutable once Completed)
`Pending ↔ Blocked` (scheduler manages based on dependency state)

**Lifecycle:** Scheduler enqueues eligible Pending tasks → Worker sets Triggered + sends email → User clicks email link → Acknowledged → User completes via grid UI.

## Frontend Pages
| Route | Component | Auth | Description |
|---|---|---|---|
| `/#/` | LandingPage | Public | Marketing page |
| `/#/login`, `/#/signup` | Login, SignUp | Public | Auth pages |
| `/#/acknowledge` | AcknowledgePage | Token | Email acknowledgement |
| `/#/dashboard` | Dashboard | JWT | Status cards, pie chart, recent tasks |
| `/#/projects` | Projects | JWT | Project list + create |
| `/#/tasks` | TaskGrid | JWT | AG Grid editor with CRUD |
| `/#/profile` | Profile | JWT | User info |

**Layout:** Collapsible dark sidebar (Dashboard/Projects/Tasks/Profile/Logout) + Header (page title, project dropdown, user email). HashRouter for proxy compatibility. `ProjectContext` provides global project state persisted in localStorage.

## API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register, /api/auth/login | Public | Auth (JWT 24h) |
| GET/POST | /api/projects, /api/projects/:id | JWT | Project CRUD |
| GET/POST/PUT/DELETE | /api/tasks, /api/tasks/:id | JWT | Task CRUD |
| GET | /api/tasks/:id/dependencies | JWT | Dependency status |
| GET | /api/acknowledge | Token | Acknowledge via email link |
| GET | /health | Public | Docker health check |
| GET/POST | /api/scheduler/status, /api/scheduler/trigger | Public | Scheduler |

## Critical Rules (non-negotiable)
1. **Backend is source of truth** — UI blocks are cosmetic, backend enforces all rules
2. **No direct email from API** — only worker sends via BullMQ email-queue
3. **4-layer dependency validation** — API middleware + service, Scheduler, Worker, Acknowledge all check independently. Cycle detection via DFS. Cross-project deps rejected.
4. **No duplicate jobs** — deterministic jobId (`task-trigger-{taskId}`), idempotent processors
5. **Completed tasks immutable** — no modifications, no status transitions out
6. **Project integrity** — projectId required + immutable, sequenceNumber auto-generated, no cross-project deps
7. **CORS** — `origin: true` (permissive) since JWT is the security boundary; needed for VS Code port forwarding

## Scheduler & Queues
Scheduler runs in API process every 60s. Phase 1: unblock Blocked→Pending. Phase 2: enqueue eligible Pending tasks. Does NOT send emails or set Triggered — only enqueues.

| Queue | Producer | Consumer | Retry |
|---|---|---|---|
| task-queue | schedulerService | taskProcessor (worker) | 3 attempts, 5s exp |
| email-queue | taskProcessor | emailProcessor (worker) | 5 attempts, 3s exp |

## Email & Auth
- **Email:** Nodemailer (SMTP or JSON mock). HMAC-SHA256 token, 7-day expiry. Rate limited 15/min/IP.
- **Auth:** JWT (24h), stored in localStorage, Axios Bearer interceptor. 401 clears token → login redirect. Acknowledge endpoint uses HMAC token (not JWT).

## Docker
| Service | Port (Host) | Health Check |
|---|---|---|
| postgres (16-alpine) | 5438 | pg_isready 5s |
| redis (7-alpine) | 6383 | redis-cli ping 5s |
| api (Node 20 + tini) | 3003 | wget /health 10s |
| worker (Node 20 + tini) | — | — |
| frontend (Nginx Alpine) | 3004 | — |

Startup: postgres+redis (healthy) → api (healthy) → frontend; postgres+redis → worker.
Nginx: SPA `try_files`, `/api/` proxy to `http://api:3001/api/`, gzip enabled.
Build args: `REACT_APP_API_URL=./api`, `PUBLIC_URL=.` (proxy compatibility).
Prisma binary targets include `linux-musl-openssl-3.0.x` for Alpine.

## Key Implementation Details
- **Grid:** Per-row 400ms debounce, failure refetches all tasks, Completed rows non-editable
- **Dashboard:** Status cards + SVG donut pie chart + recent tasks table (last 8), all project-scoped
- **Projects page:** List with active indicator, inline create form, auto-selects new project
- **Dependency service:** `canTaskExecute`, `assertDependenciesMet`, `wouldCreateCycle`, `setDependencies` — all enforce same-project
- **Task service:** `ALLOWED_TRANSITIONS` map, double validation (middleware + service), audit log in transaction
- **Error handling:** ZodError → 400 with messages, AppError → custom status, else → 500

## Development Commands
```bash
# Local dev
cd backend && npm run dev          # API on :3002
cd worker && npm run dev           # Worker
cd frontend && npm start           # Frontend on :3000
cd backend && npx prisma studio    # DB browser on :5555
cd backend && npm run db:seed      # Seed 2 projects, 5 tasks

# Docker
cd docker && docker compose up --build -d    # Start all
docker compose logs -f api                   # View logs
docker compose down -v                       # Stop + remove data

# Prisma Studio against Docker DB
DATABASE_URL="postgresql://deployflow:change-me-in-production@localhost:5438/deployflow" npx prisma studio
```

## Environment Variables
**Required:** `DATABASE_URL`, `JWT_SECRET`, `ACK_TOKEN_SECRET`
**Optional:** `REDIS_HOST` (localhost), `REDIS_PORT` (6379), `API_PORT` (3001), `FRONTEND_URL` (http://localhost:3004), `SMTP_HOST/PORT/USER/PASS` (mock if blank), `EMAIL_DOMAIN` (tilli.pro), `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (DeployFlow), `EMAIL_FALLBACK_TEAM` (ops), `ACK_TOKEN_EXPIRY_MS` (7 days)
**Docker-only:** `POSTGRES_PORT` (5438), `REDIS_PORT` (6383), `API_PORT` (3003), `FRONTEND_PORT` (3004)

## Migrations
| Migration | Description |
|---|---|
| `20260416110859_init` | User, Task, TaskDependency, AuditLog |
| `20260417120000_add_project_support` | Project model, projectId + sequenceNumber on Task |
