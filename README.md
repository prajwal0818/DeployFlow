# DeployFlow

A production-grade deployment task orchestration and automation system. Replaces Excel-based deployment tracking with a scalable, event-driven platform featuring an Excel-like UI, automated scheduling, email notifications, and task dependency management.

## Architecture

```
Frontend (React + AG Grid + Nginx)
        |
Backend API (Express + Prisma)
        |
PostgreSQL ---- Redis
                  |
            BullMQ Queues
                  |
          Worker (Email + Tasks)
```

**Five independent services:**

| Service      | Role                                             | Port (Docker) |
|--------------|--------------------------------------------------|---------------|
| **frontend** | React SPA served by Nginx, proxies /api to API   | 3004          |
| **api**      | REST API, scheduler, business logic               | 3003          |
| **worker**   | BullMQ job processor (task transitions + emails)  | --            |
| **postgres** | Primary database (source of truth)                | 5438          |
| **redis**    | Job queues, rate limiting, caching                | 6383          |

## Tech Stack

- **Frontend:** React 18, AG Grid Community 32, React Router 6 (HashRouter), Axios, TailwindCSS
- **Backend:** Node.js 20, Express 4, Prisma 5, Zod, JWT (jsonwebtoken), Pino
- **Worker:** Node.js 20, BullMQ 5, Nodemailer, Prisma 5
- **Database:** PostgreSQL 16
- **Queue/Cache:** Redis 7, BullMQ
- **Infrastructure:** Docker, Docker Compose, Nginx (gzip, SPA routing, API proxy)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Local Development

```bash
# 1. Clone and install
git clone <repo-url> && cd DeployFlow
cd backend && npm install && cd ..
cd worker && npm install && cd ..
cd frontend && npm install && cd ..

# 2. Configure environment
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
# Edit .env files — set DATABASE_URL, REDIS_HOST, JWT_SECRET, ACK_TOKEN_SECRET

# 3. Set up database
cd backend
npx prisma migrate dev
npm run db:seed   # optional: creates 3 sample tasks
cd ..

# 4. Start services (3 terminals)
cd backend && npm run dev      # API on :3001
cd worker && npm run dev       # Worker (no port)
cd frontend && npm start       # Frontend on :3000
```

### Docker (Production)

```bash
cd docker
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, ACK_TOKEN_SECRET

docker compose up --build -d
```

Services will be available at:
- **Frontend:** http://localhost:3004 (Nginx with API proxy)
- **API:** http://localhost:3003

See [INSTRUCTIONS.md](INSTRUCTIONS.md) for detailed setup and configuration.

## Data Model

### Task

| Field            | Type     | Description                              |
|------------------|----------|------------------------------------------|
| id               | UUID     | Primary key                              |
| system           | String   | System name (FOL, SAP GW, Fiserv, etc.) |
| taskName         | String   | Task description                         |
| description      | String?  | Detailed notes                           |
| assignedTeam     | String?  | Team responsible                         |
| assignedUserId   | UUID?    | Assigned user (FK to User)               |
| plannedStartTime | DateTime?| Scheduled start                          |
| plannedEndTime   | DateTime?| Scheduled end                            |
| actualStartTime  | DateTime?| Set on acknowledgement                   |
| actualEndTime    | DateTime?| Set on completion                        |
| status           | String   | Pending/Triggered/Acknowledged/Completed/Blocked |
| notes            | String?  | Free-text notes                          |

### Task Lifecycle

```
Pending ──→ Triggered ──→ Acknowledged ──→ Completed
   │
   └──→ Blocked (dependencies not met)
            │
            └──→ Pending (when dependencies complete)
```

**Status transitions:**
- `Pending → Triggered`: Scheduler queues task, worker transitions it
- `Triggered → Acknowledged`: User clicks email acknowledgement link
- `Acknowledged → Completed`: User marks task done via UI
- `Pending ↔ Blocked`: Scheduler manages based on dependency state

### Dependencies

- Tasks can depend on one or more other tasks
- A task cannot advance past `Pending` unless ALL dependencies are `Completed`
- Circular dependencies are detected and rejected (DFS algorithm)
- Validated at four layers: API, scheduler, worker, acknowledge endpoint

## API Endpoints

### Auth (Public)
| Method | Path                | Description        |
|--------|---------------------|--------------------|
| POST   | /api/auth/register  | Create account     |
| POST   | /api/auth/login     | Get JWT token      |

### Tasks (JWT Required)
| Method | Path                        | Description              |
|--------|-----------------------------|--------------------------|
| GET    | /api/tasks                  | List tasks (filterable)  |
| GET    | /api/tasks/:id              | Get single task          |
| POST   | /api/tasks                  | Create task              |
| PUT    | /api/tasks/:id              | Update task              |
| DELETE | /api/tasks/:id              | Delete task              |
| GET    | /api/tasks/:id/dependencies | Dependency status        |

### Acknowledge (Public, rate-limited)
| Method | Path                                         | Description              |
|--------|----------------------------------------------|--------------------------|
| GET    | /api/acknowledge?task_id=ID&token=TOKEN      | Acknowledge task via email link |

### System
| Method | Path                     | Description                |
|--------|--------------------------|----------------------------|
| GET    | /health                  | Health check               |
| GET    | /api/scheduler/status    | Scheduler stats            |
| POST   | /api/scheduler/trigger   | Manual scheduler tick      |

## Frontend Pages

| Route (Hash)      | Page          | Description                                    |
|-------------------|---------------|------------------------------------------------|
| `/#/`             | Dashboard     | Overview cards (task counts by status), recent tasks table |
| `/#/tasks`        | Task Grid     | AG Grid Excel-like editor with full CRUD       |
| `/#/login`        | Login         | Email/password authentication                  |
| `/#/acknowledge`  | Acknowledge   | Public page for email acknowledgement links    |

**Layout:**
- Dark sidebar with navigation (Dashboard, Tasks) and logout button
- Header with page title and logged-in user email
- Protected routes redirect to login when token is missing or expired

## Key Features

- **Excel-like UI** — AG Grid with inline editing, dropdowns, date pickers, keyboard navigation
- **Dashboard** — Status overview cards and recent tasks table
- **Per-row debounced updates** — 400ms accumulation window before API call
- **Four-layer dependency validation** — API middleware, scheduler, worker, and acknowledge endpoint
- **HMAC-SHA256 acknowledgement tokens** — Signed, time-limited, task-bound
- **Idempotent operations** — Duplicate job prevention via BullMQ job IDs + status checks
- **Audit trail** — Every field change logged with old/new values
- **Rate limiting** — Redis sliding-window per IP
- **Retry with exponential backoff** — 3 attempts for tasks, 5 for emails
- **401 auto-redirect** — Axios interceptor clears expired tokens and redirects to login
- **Gzip compression** — Nginx compresses JS/CSS/JSON responses

## Project Structure

```
DeployFlow/
├── backend/                # Express API + Scheduler
│   ├── prisma/             # Schema, migrations, seed
│   └── src/
│       ├── config/         # Environment, logger, prisma, redis
│       ├── controllers/    # Request handlers
│       ├── middleware/      # Auth, validation, rate limiting
│       ├── routes/         # Endpoint definitions
│       ├── services/       # Business logic
│       ├── validators/     # Zod schemas
│       └── utils/          # Token verification, error classes
├── worker/                 # BullMQ job processor
│   └── src/
│       ├── config/         # Environment, logger, prisma, redis
│       ├── processors/     # Task + email job handlers
│       ├── queues/         # BullMQ worker setup
│       └── services/       # Email, dependency checking
├── frontend/               # React SPA
│   └── src/
│       ├── components/
│       │   ├── auth/       # Login, ProtectedRoute
│       │   ├── dashboard/  # Dashboard (overview + recent tasks)
│       │   ├── grid/       # TaskGrid, columnDefs, cellRenderers
│       │   ├── layout/     # MainLayout, Header, Sidebar
│       │   └── acknowledge/# AcknowledgePage
│       ├── hooks/          # useTaskData
│       ├── services/       # Axios API client (JWT + 401 interceptor)
│       └── utils/          # Constants
└── docker/                 # Docker Compose + Dockerfiles
    ├── nginx/              # Nginx config (gzip, SPA, API proxy)
    ├── api.Dockerfile
    ├── worker.Dockerfile
    └── frontend.Dockerfile # Multi-stage: React build + Nginx
```

## Critical Rules

1. **UI is NOT the source of truth** — backend validates everything
2. **No direct email sending from API** — emails go through worker via BullMQ
3. **No bypassing dependency checks** — enforced at API, scheduler, worker, and acknowledge layers
4. **No duplicate jobs** — BullMQ job IDs ensure idempotency
5. **Backend enforces all status transitions** — invalid transitions are rejected

## License

Private
