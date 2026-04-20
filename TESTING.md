# DeployFlow — Testing Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [API Testing](#api-testing)
3. [Project Management Testing](#project-management-testing)
4. [Task Lifecycle Testing](#task-lifecycle-testing)
5. [Dependency Engine Testing](#dependency-engine-testing)
6. [Cross-Project Dependency Testing](#cross-project-dependency-testing)
7. [Scheduler Testing](#scheduler-testing)
8. [Email & Acknowledgement Testing](#email--acknowledgement-testing)
9. [Frontend Testing](#frontend-testing)
10. [Security Testing](#security-testing)
11. [Docker Testing](#docker-testing)

---

## Prerequisites

Ensure the following are running:

```bash
# Option 1: Local development
cd backend && npm run dev      # Terminal 1
cd worker && npm run dev       # Terminal 2
cd frontend && npm start       # Terminal 3

# Option 2: Docker
cd docker && docker compose up --build -d
```

Set the API base URL depending on your setup:

```bash
# Local development
API=http://localhost:3001

# Docker
API=http://localhost:3003
```

Register a test user and export the token:

```bash
# Register
curl -s -X POST $API/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}' | jq

# Login
TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token')

echo $TOKEN
```

Use the token in all subsequent requests:

```bash
AUTH="Authorization: Bearer $TOKEN"
```

---

## API Testing

### Health Check

```bash
curl $API/health
# Expected: {"status":"ok"}
```

### Create a Project

```bash
PROJECT=$(curl -s -X POST $API/api/projects \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Q4 Release","code":"Q4-REL","description":"Q4 production release"}')

PROJECT_ID=$(echo $PROJECT | jq -r '.id')
echo "Project ID: $PROJECT_ID"
echo $PROJECT | jq
```

### Create a Task

```bash
curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{
    \"system\": \"FOL\",
    \"taskName\": \"Pre-deploy DB backup\",
    \"description\": \"Full database snapshot\",
    \"assignedTeam\": \"DBA\",
    \"projectId\": \"$PROJECT_ID\",
    \"plannedStartTime\": \"2025-01-01T10:00:00Z\"
  }" | jq
# Expected: task with sequenceNumber=1, project object included
```

### List Tasks

```bash
# All tasks for a project
curl -s "$API/api/tasks?projectId=$PROJECT_ID" -H "$AUTH" | jq

# Filter by status within a project
curl -s "$API/api/tasks?projectId=$PROJECT_ID&status=Pending" -H "$AUTH" | jq

# Filter by system
curl -s "$API/api/tasks?system=FOL" -H "$AUTH" | jq
```

### Update a Task

```bash
TASK_ID="<uuid-from-create>"

curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"notes": "Updated via API test"}' | jq
```

### Delete a Task

```bash
curl -s -X DELETE "$API/api/tasks/$TASK_ID" -H "$AUTH" -w "%{http_code}"
# Expected: 204
```

### Verify Validation

```bash
# Missing projectId (should fail with 400)
curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"system":"FOL","taskName":"No project"}' | jq
# Expected: 400 "projectId is required"

# Missing required field (should fail with 400)
curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"description": "Missing system and taskName"}' | jq

# Invalid status value (should fail with 400)
curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status": "InvalidStatus"}' | jq

# Attempt to change projectId (should fail with 400)
curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"projectId\": \"$(uuidgen)\"}" | jq
# Expected: 400 "Cannot change projectId after task creation"
```

---

## Project Management Testing

### Create Multiple Projects

```bash
# Create project A
PROJ_A=$(curl -s -X POST $API/api/projects \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Alpha Release","code":"ALPHA","description":"Alpha deployment"}' | jq -r '.id')

# Create project B
PROJ_B=$(curl -s -X POST $API/api/projects \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Beta Release","code":"BETA","description":"Beta deployment"}' | jq -r '.id')

echo "Project A: $PROJ_A"
echo "Project B: $PROJ_B"
```

### Verify Duplicate Code Rejection

```bash
curl -s -X POST $API/api/projects \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Another Alpha","code":"ALPHA"}' | jq
# Expected: 409 "Project code already exists"
```

### List Projects

```bash
curl -s $API/api/projects -H "$AUTH" | jq
```

### Verify Per-Project Sequence Numbers

```bash
# Create tasks in project A
TASK_A1=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task A1\",\"projectId\":\"$PROJ_A\"}" | jq -r '.sequenceNumber')

TASK_A2=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task A2\",\"projectId\":\"$PROJ_A\"}" | jq -r '.sequenceNumber')

# Create tasks in project B
TASK_B1=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task B1\",\"projectId\":\"$PROJ_B\"}" | jq -r '.sequenceNumber')

echo "A1 seq: $TASK_A1, A2 seq: $TASK_A2, B1 seq: $TASK_B1"
# Expected: A1=1, A2=2, B1=1 (sequence numbers reset per project)
```

### Verify Same Task Names Across Projects

```bash
# Same task name in both projects — should succeed
curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"DB Backup\",\"projectId\":\"$PROJ_A\"}" | jq '.sequenceNumber'

curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"DB Backup\",\"projectId\":\"$PROJ_B\"}" | jq '.sequenceNumber'
# Expected: both succeed with different sequence numbers
```

---

## Task Lifecycle Testing

Test the full status flow: `Pending → Triggered → Acknowledged → Completed`.

### Step 1: Create a Pending Task

```bash
TASK=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{
    \"system\": \"FOL\",
    \"taskName\": \"Lifecycle test task\",
    \"projectId\": \"$PROJECT_ID\",
    \"plannedStartTime\": \"2024-01-01T00:00:00Z\"
  }")

TASK_ID=$(echo $TASK | jq -r '.id')
echo "Task ID: $TASK_ID"
echo $TASK | jq '.status'
# Expected: "Pending"
```

### Step 2: Trigger via Scheduler

```bash
# Force scheduler tick
curl -s -X POST $API/api/scheduler/trigger | jq

# Check task status (should be Triggered after worker processes it)
sleep 3
curl -s "$API/api/tasks/$TASK_ID" -H "$AUTH" | jq '.status'
# Expected: "Triggered"
```

### Step 3: Verify Invalid Transition

```bash
# Try to jump Triggered → Completed (should fail)
curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status": "Completed"}' | jq
# Expected: 400 "Invalid status transition: Triggered -> Completed"
```

### Step 4: Acknowledge (via UI or Direct API)

```bash
# The acknowledge endpoint requires a signed token from the email.
# For testing, transition via the task update API:
curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status": "Acknowledged"}' | jq '.status'
# Expected: "Acknowledged"
```

### Step 5: Complete

```bash
curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status": "Completed"}' | jq '.status'
# Expected: "Completed"
```

### Step 6: Verify Immutability

```bash
# Try to modify a completed task (should fail)
curl -s -X PUT "$API/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"notes": "Trying to update completed task"}' | jq
# Expected: 400 "Cannot modify a completed task"
```

---

## Dependency Engine Testing

### Setup: Create Three Tasks in Same Project

```bash
TASK_A=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task A - DB Backup\",\"projectId\":\"$PROJECT_ID\"}" | jq -r '.id')

TASK_B=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"SAP GW\",\"taskName\":\"Task B - Deploy Service\",\"projectId\":\"$PROJECT_ID\"}" | jq -r '.id')

TASK_C=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"Fiserv\",\"taskName\":\"Task C - Smoke Test\",\"projectId\":\"$PROJECT_ID\"}" | jq -r '.id')

echo "A=$TASK_A  B=$TASK_B  C=$TASK_C"
```

### Test: Set Dependencies (C depends on A and B)

```bash
curl -s -X PUT "$API/api/tasks/$TASK_C" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"dependencies\": [\"$TASK_A\", \"$TASK_B\"]}" | jq '.dependencies'
# Expected: array with A and B UUIDs
```

### Test: Dependency Status Endpoint

```bash
curl -s "$API/api/tasks/$TASK_C/dependencies" -H "$AUTH" | jq
# Expected: { executable: false, blockingTasks: [A, B] }
```

### Test: Block Advancement With Unmet Dependencies

```bash
# Try to trigger C while A and B are still Pending (should fail)
curl -s -X PUT "$API/api/tasks/$TASK_C" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"status": "Triggered"}' | jq
# Expected: 400 "Dependencies not completed: Task A - DB Backup (Pending), Task B - Deploy Service (Pending)"
```

### Test: Circular Dependency Detection

```bash
# A depends on C (C already depends on A → cycle)
curl -s -X PUT "$API/api/tasks/$TASK_A" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"dependencies\": [\"$TASK_C\"]}" | jq
# Expected: 400 "Circular dependency detected"
```

### Test: Self-Dependency

```bash
curl -s -X PUT "$API/api/tasks/$TASK_A" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"dependencies\": [\"$TASK_A\"]}" | jq
# Expected: 400 "A task cannot depend on itself"
```

### Test: Scheduler Blocking

```bash
# Give C a past planned start time
curl -s -X PUT "$API/api/tasks/$TASK_C" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"plannedStartTime": "2024-01-01T00:00:00Z"}' | jq

# Trigger scheduler — C should be Blocked (A and B not Completed)
curl -s -X POST $API/api/scheduler/trigger | jq
sleep 2

curl -s "$API/api/tasks/$TASK_C" -H "$AUTH" | jq '.status'
# Expected: "Blocked"
```

---

## Cross-Project Dependency Testing

### Setup: Create Tasks in Two Different Projects

```bash
# Create two projects
PROJ_X=$(curl -s -X POST $API/api/projects \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Project X","code":"PROJ-X"}' | jq -r '.id')

PROJ_Y=$(curl -s -X POST $API/api/projects \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Project Y","code":"PROJ-Y"}' | jq -r '.id')

# Create a task in each project
TASK_X=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task in X\",\"projectId\":\"$PROJ_X\"}" | jq -r '.id')

TASK_Y=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task in Y\",\"projectId\":\"$PROJ_Y\"}" | jq -r '.id')

echo "Task X: $TASK_X  Task Y: $TASK_Y"
```

### Test: Cross-Project Dependency Must Fail

```bash
# Try to make Task Y depend on Task X (different projects)
curl -s -X PUT "$API/api/tasks/$TASK_Y" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"dependencies\": [\"$TASK_X\"]}" | jq
# Expected: 400 "Cross-project dependencies are not allowed"
```

### Test: Same-Project Dependency Should Succeed

```bash
# Create another task in project X
TASK_X2=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Task X2\",\"projectId\":\"$PROJ_X\"}" | jq -r '.id')

# Make Task X2 depend on Task X (same project) — should work
curl -s -X PUT "$API/api/tasks/$TASK_X2" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"dependencies\": [\"$TASK_X\"]}" | jq '.dependencies'
# Expected: array with Task X UUID
```

---

## Scheduler Testing

### Check Scheduler Status

```bash
curl -s $API/api/scheduler/status | jq
```

### Manual Trigger

```bash
curl -s -X POST $API/api/scheduler/trigger | jq
```

### Verify Scheduler Behavior

1. Create a task with `plannedStartTime` in the past and no dependencies
2. Trigger the scheduler
3. Wait 2-3 seconds for the worker to process
4. Check that the task status changed from `Pending` to `Triggered`

```bash
# Create task with past start time
SCHED_TASK=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{
    \"system\": \"FOL\",
    \"taskName\": \"Scheduler test\",
    \"projectId\": \"$PROJECT_ID\",
    \"plannedStartTime\": \"2024-01-01T00:00:00Z\"
  }" | jq -r '.id')

# Trigger scheduler
curl -s -X POST $API/api/scheduler/trigger | jq

# Wait for worker processing
sleep 3

# Verify
curl -s "$API/api/tasks/$SCHED_TASK" -H "$AUTH" | jq '.status'
# Expected: "Triggered"
```

### Verify Future Tasks Are Not Triggered

```bash
# Create task with future start time
FUTURE_TASK=$(curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{
    \"system\": \"FOL\",
    \"taskName\": \"Future task\",
    \"projectId\": \"$PROJECT_ID\",
    \"plannedStartTime\": \"2099-12-31T23:59:59Z\"
  }" | jq -r '.id')

curl -s -X POST $API/api/scheduler/trigger | jq
sleep 2

curl -s "$API/api/tasks/$FUTURE_TASK" -H "$AUTH" | jq '.status'
# Expected: "Pending" (not triggered — start time is in the future)
```

---

## Email & Acknowledgement Testing

### Verify Email Sending (Mock Mode)

With default config (no SMTP), emails are logged to the worker console:

1. Create a task with a past `plannedStartTime`
2. Trigger the scheduler
3. Watch worker logs for the email output:

```bash
# If using Docker:
docker compose logs -f worker

# Look for: "Email sent" log entries with messageId
```

### Test Acknowledgement Endpoint

The `/acknowledge` endpoint requires a signed token from the email. For manual testing:

```bash
# 1. Check worker logs for the acknowledgement URL after triggering a task
# The URL looks like:
#   http://localhost:3004/#/acknowledge?task_id=<UUID>&token=<SIGNED_TOKEN>

# 2. Extract the task_id and token from the URL and call:
curl -s "$API/api/acknowledge?task_id=<TASK_ID>&token=<TOKEN>" | jq
# Expected: { message: "Task acknowledged successfully", status: "Acknowledged", ... }
```

### Test Idempotent Acknowledgement

```bash
# Call the same acknowledge URL twice
curl -s "$API/api/acknowledge?task_id=<TASK_ID>&token=<TOKEN>" | jq
# First call: { message: "Task acknowledged successfully" }

curl -s "$API/api/acknowledge?task_id=<TASK_ID>&token=<TOKEN>" | jq
# Second call: { message: "Task already acknowledged" } (200, not error)
```

### Test Invalid Token

```bash
curl -s "$API/api/acknowledge?task_id=<TASK_ID>&token=invalid.token" | jq
# Expected: 403 { error: "Invalid token signature" }
```

### Test Rate Limiting

```bash
# Send 20 rapid requests (limit is 15/minute)
for i in $(seq 1 20); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "$API/api/acknowledge?task_id=fake&token=fake")
  echo "Request $i: $STATUS"
done
# Expected: Requests 1-15 return 403 (invalid token), requests 16+ return 429 (rate limited)
```

---

## Frontend Testing

### Login Flow

1. Navigate to http://localhost:3004 (Docker) or http://localhost:3000 (local)
2. Landing page displays with "Get Started" and "Login" buttons
3. Click "Get Started" → navigates to `/#/signup`
4. Register a new account → redirects to `/#/dashboard`
5. Or click "Login" → `/#/login` → enter credentials → redirects to `/#/dashboard`
6. Refresh the page — should stay on dashboard (token persisted)

### Project Management

1. Click **Projects** in the sidebar → navigates to `/#/projects`
2. The page shows a list of all projects (or empty state if none)
3. Click **+ New Project** → inline form appears
4. Fill in Name (e.g. "Q4 Release"), Code (e.g. "Q4-REL", auto-uppercased), optional Description
5. Click **Create Project** → project appears in the list and is auto-selected as active
6. Click any project row to make it the active project
7. The active project shows a blue left border and "Active" badge
8. Verify the **Header dropdown** updates to show the newly selected project

### Project Switching

1. Use the **project selector dropdown** in the Header to switch projects
2. Navigate to Dashboard — task counts should change based on the selected project
3. Navigate to Tasks — grid should show only tasks for the selected project
4. Create a task in project A, switch to project B — the task should not appear

### Dashboard

1. After login, click **Dashboard** in sidebar
2. If a project is selected, displays:
   - **Status cards** — Pending, Triggered, Acknowledged, Completed, Blocked counts
   - **Recent tasks table** — Last 8 tasks sorted by update time, with Display ID column (e.g. Q3-PROD-1)
3. If no project is selected, shows "Select a project to view the dashboard"
4. Click any status card to navigate to the Tasks page
5. Verify counts match the actual task data for the selected project

### Navigation

1. **Sidebar** — Dark panel on the left with Dashboard, Projects, Tasks, Profile links
2. Click each link — navigates correctly with active state highlighting
3. **Header** — Shows page title, project selector dropdown, and logged-in user email
4. Click **user email** in header → navigates to `/#/profile`
5. **Logout** — Click logout button in sidebar, should clear token and redirect to login

### Grid Operations

**Add Task:**
1. Navigate to Tasks (`/#/tasks`)
2. If no project selected, shows "Select a project to view tasks"
3. With a project selected, click the **+ Add Task** button
4. A new row appears at the bottom with the project's next sequence number
5. The **ID column** (pinned left) shows `PROJECT-CODE-N` (e.g. `Q3-PROD-4`)
6. Fill in system and task name (required)
7. Row is saved automatically via debounced API call

**Edit Task:**
1. Double-click any editable cell
2. Modify the value
3. Press Enter or click away
4. Changes are sent to the API after 400ms

**Status Dropdown:**
1. Click a status cell
2. Select from the dropdown (Pending, Triggered, Acknowledged, Completed, Blocked)
3. Invalid transitions are rejected by the backend

**Dependency Picker:**
1. Click a dependencies cell
2. A popup appears with searchable checkboxes
3. Select one or more tasks (only tasks from the same project appear)
4. Close the popup — dependencies are saved

**Date/Time Picker:**
1. Click a planned start/end time cell
2. A datetime picker appears
3. Select a date and time
4. Value is saved in ISO format

**Delete Task:**
1. Select one or more rows (click row checkbox)
2. Click the "Delete Selected" button
3. Confirm the deletion

### Sign Up Page

1. Navigate to `/#/login`
2. Click "Don't have an account? Sign Up" → navigates to `/#/signup`
3. Fill in Name, Email, Password (min 8 chars), Confirm Password
4. If passwords don't match, client-side error shows
5. Click "Sign Up" → registers and redirects to `/#/dashboard`
6. "Already have an account? Sign In" link navigates back to login

### Profile Page

1. Click **Profile** in sidebar or click user email in header
2. Shows avatar with initials, Name, Email, Role, User ID
3. Password section shows "Coming Soon" badge

### Acknowledge Page

1. When a task is triggered, the worker sends an email with an acknowledgement link
2. The link opens `http://localhost:3004/#/acknowledge?task_id=...&token=...`
3. The page should show a success or error card
4. No login is required (public page, protected by signed token)

---

## Security Testing

### Authentication

```bash
# Request without token (should fail)
curl -s $API/api/tasks | jq
# Expected: 401 "Missing or invalid authorization header"

# Request with invalid token
curl -s $API/api/tasks \
  -H "Authorization: Bearer invalid-token" | jq
# Expected: 401 "Invalid or expired token"

# Request with valid token (should succeed)
curl -s $API/api/tasks -H "$AUTH" | jq
# Expected: 200 with task array
```

### Input Validation

```bash
# SQL injection attempt in task name
curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"Robert; DROP TABLE tasks;--\",\"projectId\":\"$PROJECT_ID\"}" | jq
# Expected: 201 (Prisma parameterizes queries — no SQL injection)

# XSS attempt
curl -s -X POST $API/api/tasks \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"system\":\"FOL\",\"taskName\":\"<script>alert(1)</script>\",\"projectId\":\"$PROJECT_ID\"}" | jq
# Expected: 201 (stored as-is, but React escapes output by default)
```

### Authorization

```bash
# Public endpoints should work without auth
curl -s $API/health | jq
# Expected: 200

curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@test.com","password":"wrong"}' | jq
# Expected: 401 "Invalid email or password"
```

---

## Docker Testing

### Verify All Services

```bash
cd docker
docker compose up --build -d

# Wait for health checks
sleep 30

# Check all services are healthy
docker compose ps

# Expected:
#   postgres   running (healthy)
#   redis      running (healthy)
#   api        running (healthy)
#   worker     running
#   frontend   running
```

### Test API Through Docker

```bash
curl http://localhost:3003/health
# Expected: {"status":"ok"}
```

### Test Frontend Through Docker

```bash
# HTML page
curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/
# Expected: 200

# Static assets (gzip compressed)
curl -s -o /dev/null -w "%{http_code}" -H "Accept-Encoding: gzip" http://localhost:3004/static/js/main.*.js
# Expected: 200

# API proxy
curl -s http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: JWT token response
```

### Seed Database in Docker

```bash
docker compose exec api node prisma/seed.js
# Expected: "Seeded 2 projects with 5 tasks and dependencies"
```

### Test Database Migrations

```bash
# Migrations run automatically on API startup
docker compose logs api | grep "migration"
# Expected: "Running database migrations..." followed by success
```

### Test Worker Processing

```bash
# Watch worker logs
docker compose logs -f worker &

# Create and trigger a task via API
# ... (use API testing steps above)

# Worker should log task processing and email sending
```

### Test Persistence

```bash
# Create some tasks, then restart
docker compose restart api worker

# Tasks should still be there after restart
curl -s "http://localhost:3003/api/tasks?projectId=$PROJECT_ID" -H "$AUTH" | jq length
```

### Cleanup

```bash
# Stop all services
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v
```
