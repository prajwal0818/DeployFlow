const prisma = require("../config/prisma");
const { canTaskExecute } = require("./dependencyService");
const { addTaskJob } = require("./queueService");
const logger = require("../config/logger");

const INTERVAL_MS = 60_000; // 1 minute
let intervalHandle = null;
let running = false;

// ── Stats (exposed for the status endpoint) ─────────────────────────────────

const stats = {
  lastRunAt: null,
  lastRunDurationMs: null,
  tasksEnqueued: 0,
  tasksBlocked: 0,
  tasksUnblocked: 0,
  errors: 0,
};

function getStats() {
  return { ...stats, running: !!intervalHandle };
}

// ── Tick ─────────────────────────────────────────────────────────────────────
// Called every minute. Two phases:
//   1. Re-evaluate Blocked tasks → move back to Pending if deps now met
//   2. Find eligible Pending tasks → enqueue or mark Blocked

async function tick() {
  if (running) {
    logger.warn("Scheduler tick skipped — previous tick still running");
    return;
  }

  running = true;
  const start = Date.now();
  let enqueued = 0;
  let blocked = 0;
  let unblocked = 0;

  try {
    // ── Phase 1: Unblock ────────────────────────────────────────────────
    // Blocked tasks whose deps are ALL Completed should return to Pending
    // so they become eligible in phase 2 (same tick or next).

    const blockedTasks = await prisma.task.findMany({
      where: { status: "Blocked" },
      select: { id: true, taskName: true },
    });

    for (const task of blockedTasks) {
      try {
        const depCheck = await canTaskExecute(task.id);
        if (depCheck.executable) {
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "Pending" },
          });
          await prisma.auditLog.create({
            data: {
              taskId: task.id,
              action: "UPDATED",
              field: "status",
              oldValue: "Blocked",
              newValue: "Pending",
            },
          });
          unblocked++;
          logger.info({ taskId: task.id }, "Task unblocked → Pending");
        }
      } catch (err) {
        stats.errors++;
        logger.error({ taskId: task.id, err: err.message }, "Unblock check failed");
      }
    }

    // ── Phase 2: Evaluate eligible Pending tasks ────────────────────────
    // Conditions: status = Pending AND planned_start_time <= now

    const now = new Date();

    const candidates = await prisma.task.findMany({
      where: {
        status: "Pending",
        plannedStartTime: { lte: now },
      },
      select: {
        id: true,
        taskName: true,
        system: true,
        assignedTeam: true,
        assignedUserId: true,
      },
    });

    // Batch-load all dependency info for candidates in a single query
    const candidateIds = candidates.map((t) => t.id);
    const allDeps =
      candidateIds.length > 0
        ? await prisma.taskDependency.findMany({
            where: { taskId: { in: candidateIds } },
            include: {
              dependsOn: { select: { id: true, status: true } },
            },
          })
        : [];

    // Group deps by taskId for O(1) lookup
    const depsByTaskId = new Map();
    for (const dep of allDeps) {
      if (!depsByTaskId.has(dep.taskId)) depsByTaskId.set(dep.taskId, []);
      depsByTaskId.get(dep.taskId).push(dep);
    }

    for (const task of candidates) {
      try {
        const deps = depsByTaskId.get(task.id) || [];
        const blocking = deps.filter(
          (d) => d.dependsOn.status !== "Completed"
        );
        const executable = blocking.length === 0;

        if (executable) {
          await addTaskJob(task);
          enqueued++;
        } else {
          // Deps not met → mark Blocked
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "Blocked" },
          });
          await prisma.auditLog.create({
            data: {
              taskId: task.id,
              action: "UPDATED",
              field: "status",
              oldValue: "Pending",
              newValue: "Blocked",
            },
          });
          blocked++;
          logger.info(
            { taskId: task.id, blockedBy: blocking.map((d) => d.dependsOn.id) },
            "Task blocked — dependencies not met"
          );
        }
      } catch (err) {
        stats.errors++;
        logger.error({ taskId: task.id, err: err.message }, "Scheduler task processing failed");
      }
    }

    const durationMs = Date.now() - start;
    stats.lastRunAt = now.toISOString();
    stats.lastRunDurationMs = durationMs;
    stats.tasksEnqueued += enqueued;
    stats.tasksBlocked += blocked;
    stats.tasksUnblocked += unblocked;

    if (enqueued > 0 || blocked > 0 || unblocked > 0) {
      logger.info(
        { enqueued, blocked, unblocked, durationMs },
        "Scheduler tick completed"
      );
    }
  } catch (err) {
    stats.errors++;
    logger.error(err, "Scheduler tick failed");
  } finally {
    running = false;
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function start() {
  if (intervalHandle) return;
  logger.info({ intervalMs: INTERVAL_MS }, "Scheduler started");
  tick(); // run immediately on startup
  intervalHandle = setInterval(tick, INTERVAL_MS);
}

function stop() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info("Scheduler stopped");
}

module.exports = { start, stop, tick, getStats };
