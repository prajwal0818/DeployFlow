# CLAUDE.md

# DeployFlow — AI Agent Instructions

This file provides context and rules for AI agents working on the DeployFlow codebase.

---

## Project Overview

DeployFlow is a production-grade deployment task orchestration system. It replaces Excel-based deployment tracking with an automated, event-driven platform.

**Core capabilities:**
- Multi-project task management with per-project sequencing
- Excel-like task editing (AG Grid)
- Dashboard with status overview and recent tasks
- Automated task scheduling and dependency resolution
- Email notifications with signed acknowledgement links
- Audit trail for all changes
- Docker-based deployment with Nginx frontend

---

## Architecture

```
Frontend (React + AG Grid + Nginx)  →  Backend API (Express + Prisma)
                                              ↓
                                      PostgreSQL (source of truth)
                                      Redis (queues + rate limiting)
                                              ↓
                                        BullMQ Queues
                                              ↓
                                      Worker (Email + Tasks)
```

Five independent services: `frontend`, `api`, `worker`, `postgres`, `redis`.

---

## Tech Stack

| Layer      | Technologies                                              |
|------------|-----------------------------------------------------------|
| Frontend   | React 18, AG Grid Community 32, React Router 6 (HashRouter), Axios, TailwindCSS |
| Backend    | Node.js 20, Express 4, Prisma 5, Zod, JWT, Pino          |
| Worker     | Node.js 20, BullMQ 5, Nodemailer, Prisma 5               |
| Database   | PostgreSQL 16                                             |
| Queue      | Redis 7, BullMQ                                           |
| Infra      | Docker, Docker Compose, Nginx (gzip, SPA, API proxy)     |

---

## Project Structure

```
backend/
  server.js                          # Entry point — starts Express + scheduler
  prisma/schema.prisma               # Database models (User, Project, Task, TaskDependency, AuditLog)
  prisma/seed.js                     # Sample data seeder (2 projects, 5 tasks)
  src/app.js                         # Express middleware setup + /health endpoint
  src/config/                        # Environment, logger, prisma client, redis client
  src/controllers/                   # taskController, authController, acknowledgeController, projectController
  src/routes/                        # Route definitions (tasks, auth, acknowledge, projects)
  src/middleware/                     # auth (JWT), validate (Zod), validateDependencies, rateLimiter, errorHandler
  src/services/                      # taskService, schedulerService, dependencyService, queueService, projectService
  src/validators/                    # Zod schemas (taskValidator, authValidator, projectValidator)
  src/utils/                         # token.js (HMAC-SHA256), errors.js (AppError)

worker/
  index.js                           # Entry point — starts BullMQ workers
  src/processors/                    # taskProcessor (Pending→Triggered), emailProcessor (sends email)
  src/queues/                        # BullMQ worker setup (task-queue, email-queue)
  src/services/                      # emailService (nodemailer + token signing), emailProducer, dependencyChecker
  src/config/                        # Environment, logger, prisma client, redis client

frontend/
  src/App.jsx                        # HashRouter, ProjectContext provider, route definitions
  src/components/auth/               # Login.jsx, SignUp.jsx, ProtectedRoute.jsx
  src/components/landing/            # LandingPage.jsx (public marketing page)
  src/components/dashboard/          # Dashboard.jsx (overview cards + recent tasks table)
  src/components/grid/               # TaskGrid.jsx, columnDefs.js, cellRenderers/
  src/components/projects/           # Projects.jsx (project list + create form)
  src/components/acknowledge/        # AcknowledgePage.jsx
  src/components/layout/             # MainLayout.jsx, Header.jsx (project selector), Sidebar.jsx
  src/components/profile/            # Profile.jsx (user info)
  src/hooks/                         # useTaskData (CRUD hook, project-scoped)
  src/services/                      # api.js (Axios + JWT interceptor), taskService.js, projectService.js
  src/utils/                         # constants.js (statuses, systems)

docker/
  docker-compose.yml                 # postgres, redis, api, worker, frontend services
  api.Dockerfile                     # Node 20 + tini + openssl + non-root user
  worker.Dockerfile                  # Node 20 + tini + openssl + non-root user
  frontend.Dockerfile                # Multi-stage: React build → Nginx Alpine
  api-entrypoint.sh                  # Runs prisma migrate deploy, then starts server
  nginx/nginx.conf                   # SPA routing, /api/ proxy, gzip compression
  .env                               # Docker environment variables
```

---

## Data Model

### Models (Prisma)

- **User** — `id, email, password, name, role, createdAt, updatedAt`
- **Project** — `id, name, code (unique), description, createdAt, updatedAt`
- **Task** — `id, system, taskName, description, assignedTeam, assignedUserId, plannedStartTime, plannedEndTime, actualStartTime, actualEndTime, status, notes, projectId, sequenceNumber, createdAt, updatedAt`
- **TaskDependency** — `id, taskId, dependsOnTaskId` (unique constraint on pair)
- **AuditLog** — `id, taskId, action, field, oldValue, newValue, userId, createdAt`

### Project–Task Relationship

- Every Task belongs to exactly one Project (`projectId` required, cannot change after creation)
- `sequenceNumber` auto-increments per project (generated in a transaction on create)
- Display ID = `project.code + "-" + sequenceNumber` (e.g. `Q3-PROD-1`)
- Constraint: `@@unique([projectId, sequenceNumber])` — no duplicates within a project
- Cross-project dependencies are **not allowed** (enforced at all validation layers)

### Task Statuses

`Pending | Triggered | Acknowledged | Completed | Blocked`

### Allowed Transitions

```
Pending     → Triggered, Blocked
Blocked     → Pending
Triggered   → Acknowledged
Acknowledged → Completed
Completed   → (none — immutable)
```

---

## Task Lifecycle

```
Pending ──→ Triggered ──→ Acknowledged ──→ Completed
   │            ↑ (worker)    ↑ (user clicks email link)
   └──→ Blocked ──→ Pending
        (deps not met)  (deps later met)
```

1. **Pending → Triggered:** Scheduler finds eligible task (time + deps), enqueues to BullMQ, worker transitions status
2. **Triggered → Acknowledged:** User clicks signed link in email, backend validates token + dependencies
3. **Acknowledged → Completed:** User updates status via grid UI
4. **Pending ↔ Blocked:** Scheduler manages based on dependency completion state

---

## Frontend Pages & Layout

### Pages

| Route (Hash)       | Component       | Auth      | Description                                    |
|--------------------|-----------------|-----------|------------------------------------------------|
| `/#/`              | LandingPage     | Public    | Marketing page with hero, features, CTA        |
| `/#/login`         | Login           | Public    | Email/password authentication                  |
| `/#/signup`        | SignUp          | Public    | User registration                              |
| `/#/acknowledge`   | AcknowledgePage | Token     | Public page for email acknowledgement links    |
| `/#/dashboard`     | Dashboard       | JWT       | Status overview cards + recent tasks table     |
| `/#/projects`      | Projects        | JWT       | Project list + create new project              |
| `/#/tasks`         | TaskGrid        | JWT       | AG Grid Excel-like editor with full CRUD       |
| `/#/profile`       | Profile         | JWT       | User account info (read-only)                  |

### Layout (MainLayout)

- **Sidebar** — Dark (bg-gray-900) navigation panel with Dashboard/Projects/Tasks/Profile links and Logout button
- **Header** — Page title (dynamic based on route), project selector dropdown, and logged-in user email (links to profile)
- **ProtectedRoute** — Redirects to `/#/login` if no token in localStorage
- **401 Interceptor** — Axios response interceptor clears expired tokens and redirects to login

### Global Project State

- `ProjectContext` in `App.jsx` provides `{ projects, selectedProjectId, setSelectedProjectId, refreshProjects }`
- `selectedProjectId` persisted in localStorage
- Header dropdown and Projects page both read/write from this context
- Dashboard, TaskGrid, and useTaskData are all scoped to the selected project

### Routing

Uses **HashRouter** (not BrowserRouter) for compatibility with:
- VS Code port forwarding (`/proxy/3004/` path prefix)
- Nginx SPA serving
- Any reverse proxy setup

---

## API Endpoints

| Method | Path                        | Auth   | Description                         |
|--------|-----------------------------|--------|-------------------------------------|
| POST   | /api/auth/register          | Public | Create user account                 |
| POST   | /api/auth/login             | Public | Get JWT token (24h expiry)          |
| GET    | /api/projects               | JWT    | List all projects                   |
| GET    | /api/projects/:id           | JWT    | Get single project                  |
| POST   | /api/projects               | JWT    | Create project (name, code, description) |
| GET    | /api/tasks                  | JWT    | List tasks (filterable by projectId, status, system) |
| GET    | /api/tasks/:id              | JWT    | Get single task (includes project)  |
| POST   | /api/tasks                  | JWT    | Create task (projectId required, sequenceNumber auto-generated) |
| PUT    | /api/tasks/:id              | JWT    | Update task (validates transitions, deps, no projectId change) |
| DELETE | /api/tasks/:id              | JWT    | Delete task                         |
| GET    | /api/tasks/:id/dependencies | JWT    | Check dependency status             |
| GET    | /api/acknowledge            | Token  | Acknowledge task via email link     |
| GET    | /health                     | Public | Health check (Docker)               |
| GET    | /api/scheduler/status       | Public | Scheduler stats                     |
| POST   | /api/scheduler/trigger      | Public | Manual scheduler tick (testing)     |

---

## Critical Rules

These rules are **non-negotiable**. Every code change must maintain them.

### 1. UI is NOT Source of Truth
- Backend validates everything: status transitions, dependencies, field types, project membership
- Frontend blocks are cosmetic — backend independently enforces all rules

### 2. No Direct Email Sending from API
- API never imports nodemailer or any email library
- Emails are sent exclusively by the worker via BullMQ email-queue
- Flow: Scheduler → task-queue → Worker → email-queue → Worker → Nodemailer

### 3. No Bypassing Dependency Checks
- Dependencies are validated at FOUR layers independently:
  - **API:** `validateDependencies` middleware + `taskService.assertDependenciesMet()`
  - **Scheduler:** `canTaskExecute()` before enqueuing
  - **Worker:** `canTaskExecute()` before transitioning Pending→Triggered
  - **Acknowledge:** `canTaskExecute()` before transitioning Triggered→Acknowledged
- Circular dependencies detected via DFS in `dependencyService.wouldCreateCycle()`
- **Cross-project dependencies are rejected** in `canTaskExecute`, `assertDependenciesMet`, and `setDependencies`

### 4. No Duplicate Jobs
- BullMQ jobs use deterministic `jobId` values: `task-trigger-{taskId}`, `email-{taskId}-triggered`
- Processors have idempotency checks (skip if status already advanced)

### 5. Idempotent Operations
- Acknowledge endpoint returns 200 "already acknowledged" on repeat clicks
- Task and email processors skip already-processed tasks
- Audit logs are created atomically within transactions

### 6. Completed Tasks Are Immutable
- `taskService.update()` rejects any modification to Completed tasks
- Frontend AG Grid blocks editing on Completed rows
- No status can transition out of Completed

### 7. Project Integrity
- Every task must have a `projectId` (enforced by Zod schema + service layer)
- `projectId` cannot be changed after task creation
- `sequenceNumber` is auto-generated per project in a transaction (no gaps guaranteed, no manual override)
- Cross-project dependencies are not allowed

---

## Scheduler Design

- Runs inside the API process on a 60-second `setInterval`
- **Phase 1 (Unblock):** Re-evaluates `Blocked` tasks — transitions back to `Pending` if dependencies now met
- **Phase 2 (Queue):** Finds `Pending` tasks where `plannedStartTime <= now` — enqueues if deps met, blocks if not
- Does NOT send emails or transition to `Triggered` — only enqueues to BullMQ
- Stats available at `GET /api/scheduler/status`

---

## Queue System

| Queue        | Producer          | Consumer               | Retry          |
|--------------|-------------------|------------------------|----------------|
| task-queue   | schedulerService  | taskProcessor (worker) | 3 attempts, 5s exponential |
| email-queue  | taskProcessor     | emailProcessor (worker)| 5 attempts, 3s exponential |

Job cleanup: completed jobs removed after 24h, failed after 7 days.

---

## Email System

- **Transport:** Nodemailer with real SMTP or JSON mock (when SMTP unconfigured)
- **Token:** HMAC-SHA256 signed, base64url-encoded payload with expiry (7 days default)
- **Format:** `base64url(JSON{taskId, exp}).base64url(signature)`
- **Verification:** `backend/src/utils/token.js` — timing-safe comparison, expiry check, taskId match
- **Rate limiting:** 15 requests/minute per IP on acknowledge endpoint (Redis sliding window)

---

## Authentication

- JWT tokens signed with `JWT_SECRET`, 24-hour expiry
- Payload: `{ sub: userId, email, role }`
- Frontend stores token in `localStorage`, Axios interceptor attaches `Authorization: Bearer` header
- 401 response interceptor clears token and redirects to `/#/login`
- `ProtectedRoute` redirects to `/login` if no token
- Acknowledge endpoint is public (protected by HMAC token, not JWT)

---

## Docker

### Services

| Service    | Image              | Port (Host) | Health Check              |
|------------|--------------------|-------------|---------------------------|
| postgres   | postgres:16-alpine | 5438        | `pg_isready` every 5s     |
| redis      | redis:7-alpine     | 6383        | `redis-cli ping` every 5s |
| api        | Node 20 + tini     | 3003        | `wget /health` every 10s  |
| worker     | Node 20 + tini     | —           | —                         |
| frontend   | Nginx Alpine       | 3004        | —                         |

### Startup Order
`postgres (healthy) + redis (healthy) → api (healthy) → frontend`
`postgres (healthy) + redis (healthy) → worker`

### Nginx (frontend)
- Serves React SPA with `try_files $uri $uri/ /index.html`
- Proxies `/api/` to `http://api:3001/api/`
- Gzip compression enabled (JS, CSS, JSON — ~73% size reduction)

### Prisma Binary Targets
`schema.prisma` includes `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` for Docker Alpine + OpenSSL 3.x compatibility.

### Build Args
- `REACT_APP_API_URL=./api` — relative API URL for proxy compatibility
- `PUBLIC_URL=.` — relative asset paths for VS Code port forwarding compatibility

All services use `restart: unless-stopped` and communicate via a `deployflow` bridge network.

---

## Database Migrations

| Migration                             | Description                                      |
|---------------------------------------|--------------------------------------------------|
| `20260416110859_init`                 | Initial schema: User, Task, TaskDependency, AuditLog |
| `20260417120000_add_project_support`  | Add Project model, projectId + sequenceNumber to Task |

---

## Development Commands

```bash
# Backend
cd backend
npm run dev              # Start with nodemon
npm run start            # Production start
npx prisma migrate dev   # Create/apply migration
npx prisma studio        # Visual DB browser
npm run db:seed          # Seed sample data (2 projects, 5 tasks)

# Worker
cd worker
npm run dev              # Start with nodemon
npm run start            # Production start

# Frontend
cd frontend
npm start                # Dev server on :3000
npm run build            # Production build

# Docker
cd docker
docker compose up --build -d      # Start all services
docker compose logs -f api        # View API logs
docker compose logs -f worker     # View worker logs
docker compose logs -f frontend   # View frontend logs
docker compose down -v            # Stop and remove data
```

---

## Environment Variables

| Variable             | Services       | Required | Default              |
|----------------------|----------------|----------|----------------------|
| DATABASE_URL         | backend, worker | Yes     | —                    |
| REDIS_HOST           | backend, worker | No      | localhost            |
| REDIS_PORT           | backend, worker | No      | 6379                 |
| JWT_SECRET           | backend        | Yes      | —                    |
| ACK_TOKEN_SECRET     | backend, worker | Yes     | dev fallback         |
| API_PORT             | backend        | No       | 3001                 |
| FRONTEND_URL         | backend, worker | No      | http://localhost:3004 |
| SMTP_HOST/PORT/USER/PASS | worker     | No       | mock transport       |
| ACK_TOKEN_EXPIRY_MS  | worker         | No       | 604800000 (7 days)   |

### Docker-Only

| Variable          | Default      |
|-------------------|--------------|
| POSTGRES_PORT     | 5438         |
| REDIS_PORT        | 6383         |
| API_PORT          | 3003         |
| FRONTEND_PORT     | 3004         |

---

## Key Implementation Details

### Multi-Project Support
- `ProjectContext` in `App.jsx` holds `{ projects, selectedProjectId, setSelectedProjectId, refreshProjects }`
- `refreshProjects(newProjectData?)` — creates a project if data passed, then re-fetches the full list
- Header dropdown and Projects page both consume the same context
- `useTaskData(projectId)` — returns empty array and skips fetch when no project selected
- `taskService.create()` generates `sequenceNumber` via `prisma.$transaction` (find max + 1)
- `taskService.update()` rejects `projectId` changes: `Cannot change projectId after task creation`

### Dependency Validation (`dependencyService.js`)
- `canTaskExecute(taskId)` — returns `{ executable, blockingTasks[] }`, validates same-project
- `assertDependenciesMet(taskId)` — throws AppError if any dep not Completed, validates same-project
- `wouldCreateCycle(taskId, targetIds)` — iterative DFS on full graph
- `setDependencies(taskId, ids)` — validates existence, self-ref, same-project, cycles, then atomically replaces

### Task Service Status Transitions (`taskService.js`)
- `ALLOWED_TRANSITIONS` map enforces valid status flow
- `STATUS_REQUIRES_DEPS_MET` set = `["Triggered", "Acknowledged"]`
- Double validation: middleware pre-checks + service re-checks independently

### Audit Logging
- Every task field change logged with `{taskId, action, field, oldValue, newValue}`
- Created atomically in same transaction as the update
- Actions: `CREATED`, `UPDATED`, `EMAIL_SENT`

### Frontend Grid Updates (`TaskGrid.jsx`)
- Per-row debounce (400ms) accumulates field changes before API call
- On failure: alerts user + refetches all tasks to resync with backend
- Completed rows are non-editable (AG Grid `editable` function checks status)
- Pinned "ID" column displays `project.code-sequenceNumber` (read-only)
- "+ Add Task" auto-includes `projectId` from context

### Dashboard (`Dashboard.jsx`)
- Fetches tasks scoped to selected project via `useTaskData(selectedProjectId)`
- Displays status count cards (Pending, Triggered, Acknowledged, Completed, Blocked)
- Shows recent tasks table (last 8, sorted by update time) with Display ID column
- Cards link to the Tasks page

### Projects Page (`Projects.jsx`)
- Lists all projects with code badge, name, description, and active indicator
- Clicking a project sets it as active (updates `selectedProjectId` in context)
- "+ New Project" opens inline form (name, code auto-uppercased, optional description)
- On create, refreshes project list and auto-selects the new project

### Sidebar (`Sidebar.jsx`)
- Dark theme (bg-gray-900) with icon + label navigation
- Nav items: Dashboard, Projects, Tasks, Profile
- NavLink with active state highlighting (bg-blue-600)
- Logout button clears localStorage token and navigates to login
