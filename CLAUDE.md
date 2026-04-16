# CLAUDE.md

# 📌 Project Name: DeployFlow
A Production-Grade Deployment Task Orchestration & Automation System

---

# 🚀 PROJECT OVERVIEW

DeployFlow is a full-stack enterprise workflow system designed to replace Excel-based deployment tracking with a scalable, automated, and event-driven platform.

It manages:
- Pre-Deployment, Deployment, Post-Deployment tasks
- Task scheduling and automation
- Email notifications
- User acknowledgements
- Task dependencies (A → B execution order)
- Real-time Excel-like editing UI

---

# 🎯 CORE OBJECTIVE

Build a system where users can:
- Create tasks like Excel rows
- Edit tasks inline (spreadsheet style)
- Delete / update / add rows instantly
- Automatically trigger workflows based on time + dependencies
- Track full deployment lifecycle in real time

---

# 🧠 SYSTEM ARCHITECTURE

Frontend (React + AG Grid Excel UI)
        ↓
Backend API (Node.js + Express)
        ↓
PostgreSQL (Source of Truth)
Redis (Queue + Cache + Rate Limiting)
        ↓
BullMQ Queue System
        ↓
Worker Services (Email + Task Processing)
        ↓
Email Provider (SMTP / SendGrid)

---

# 🧱 TECH STACK

## Frontend
- React (or Next.js)
- AG Grid (Excel-like UI)
- Axios
- TailwindCSS or Material UI

## Backend
- Node.js + Express
- Prisma ORM
- Zod/Joi validation
- JWT authentication

## Queue System
- Redis
- BullMQ (job processing)

## Database
- PostgreSQL (primary DB)

## Infrastructure
- Docker & Docker Compose
- Optional Nginx reverse proxy

---

# 🧩 CORE DATA MODEL

## Task
- id
- system (FOL, SAP GW, Fiserv, etc.)
- task_name
- description
- assigned_team
- assigned_user
- planned_start_time
- planned_end_time
- actual_start_time
- actual_end_time
- status (Pending | Triggered | Acknowledged | Completed | Blocked)
- notes

## TaskDependency
- id
- task_id
- depends_on_task_id

---

# 🔄 TASK LIFECYCLE

Pending → Triggered → Acknowledged → Completed  
Blocked (if dependencies not met)

---

# 🔗 DEPENDENCY ENGINE RULES

- A task can depend on one or more tasks
- Task cannot start unless ALL dependencies are Completed
- Prevent circular dependencies
- Dependency validation must occur at:
  - API layer
  - Scheduler layer
  - Worker layer

---

# 🖥️ FRONTEND (EXCEL-LIKE UI REQUIREMENTS)

## UI Behavior
- Must behave like Excel / Google Sheets
- Inline editing for all cells
- Add / delete rows dynamically
- Copy-paste bulk rows supported
- Real-time updates to backend (debounced)

## Grid Features (AG Grid)
- Column editing
- Dropdowns for status
- Dropdown for dependencies
- Date/time picker support
- Row selection
- Keyboard navigation

## Editable Fields
- system
- task_name
- assigned_user
- planned_start_time
- status
- dependencies

## Rules
- Block editing if task is Completed or Locked
- Block updates if dependencies are not satisfied
- UI is NOT source of truth

---

# ⚙️ BACKEND RESPONSIBILITIES

- Enforce all business rules
- Validate dependency chains
- Prevent invalid status transitions
- Maintain audit logs
- Ensure idempotent operations

---

# ⏱️ SCHEDULER DESIGN

- Runs every minute (cron OR worker trigger)
- ONLY pushes eligible tasks into queue
- Does NOT send emails directly

Logic:
- If current_time >= planned_start_time
- AND status = Pending
- AND dependencies = satisfied
→ push to Redis queue

Else:
→ mark as Blocked

---

# 📦 QUEUE SYSTEM (BULLMQ + REDIS)

Queues:
- email-queue → sends emails
- task-queue → processes task transitions

Features:
- Retry with exponential backoff
- Delayed jobs supported
- Idempotent job processing (no duplicates)

---

# 📧 EMAIL SYSTEM

- Triggered only via worker
- Includes acknowledgement link:

/acknowledge?task_id=ID&token=SECURE_TOKEN

- Must support retry logic
- Must prevent duplicate emails

---

# 🔁 ACKNOWLEDGEMENT FLOW

1. User receives email
2. Clicks acknowledgement link
3. Backend validates token
4. Updates:
   - status → Acknowledged
   - actual_start_time = now

---

# 🐳 DOCKER ARCHITECTURE

Services:
- api (Node.js backend)
- worker (BullMQ processor)
- redis
- postgres

Rules:
- Worker runs independently from API
- System must support horizontal scaling
- Stateless API design

---

# 🔐 SECURITY REQUIREMENTS

- JWT authentication
- Secure acknowledgement tokens (signed)
- Input validation (Zod/Joi)
- Rate limiting via Redis
- Prevent unauthorized task modification

---

# 📈 PRODUCTION REQUIREMENTS

- Retry mechanism for all background jobs
- Centralized logging (Winston/Pino)
- Error handling at all layers
- Audit trail for all task changes
- No duplicate email sending
- Idempotent API design

---

# 🔄 DATA FLOW

User Action (UI Excel Edit)
        ↓
Frontend (AG Grid)
        ↓
Debounced API call
        ↓
Backend validation
        ↓
PostgreSQL update
        ↓
Scheduler picks eligible tasks
        ↓
Redis Queue
        ↓
Worker processes job
        ↓
Email sent + status updated

---

# 🚨 CRITICAL RULES

- UI is NOT source of truth
- Backend must validate everything
- No direct email sending from API
- No bypassing dependency checks
- No duplicate jobs allowed
- Always ensure idempotency

---

# 💡 FUTURE IMPROVEMENTS

- Real-time WebSocket updates
- Gantt chart view of deployments
- Slack / Teams integration
- Role-based access control (RBAC)
- Multi-environment deployment tracking
- Audit dashboard

---

# 🎯 FINAL GOAL

DeployFlow should function as:

✔ Excel-like task management system  
✔ Workflow automation engine  
✔ Distributed job processing system  
✔ Production-grade deployment orchestration tool  
✔ Scalable DevOps coordination platform  

---
