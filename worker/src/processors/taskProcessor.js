const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { canTaskExecute } = require("../services/dependencyChecker");
const { addEmailJob } = require("../services/emailProducer");

/**
 * task-queue processor.
 *
 * Flow:
 *   1. Fetch task from DB
 *   2. Idempotency: skip if not Pending
 *   3. Dependency check (worker layer — per CLAUDE.md)
 *   4. Transition status → Triggered
 *   5. Audit log
 *   6. Enqueue email job (email processor handles token signing + sending)
 */
module.exports = async (job) => {
  const { taskId } = job.data;
  const log = logger.child({ jobId: job.id, taskId });

  log.info("Processing task job");

  // ── 1. Fetch task ────────────────────────────────────────────────────
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedUser: { select: { id: true, email: true, name: true } },
    },
  });

  if (!task) {
    log.warn("Task not found in DB — skipping");
    return { status: "skipped", reason: "task_not_found" };
  }

  // ── 2. Idempotency ──────────────────────────────────────────────────
  if (task.status !== "Pending") {
    log.info({ currentStatus: task.status }, "Task already processed — skipping");
    return { status: "skipped", reason: "already_processed" };
  }

  // ── 3. Dependency check (worker layer) ───────────────────────────────
  const depCheck = await canTaskExecute(taskId);
  if (!depCheck.executable) {
    const blockers = depCheck.blockingTasks.map((t) => t.taskName).join(", ");
    log.warn({ blockers }, "Dependencies not met — will retry");
    throw new Error(`Dependencies not met: ${blockers}`);
  }

  // ── 4. Transition Pending → Triggered ────────────────────────────────
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "Triggered" },
  });

  // ── 5. Audit log ────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      taskId,
      action: "UPDATED",
      field: "status",
      oldValue: "Pending",
      newValue: "Triggered",
    },
  });

  log.info("Task status → Triggered");

  // ── 6. Enqueue email ────────────────────────────────────────────────
  // Only taskId is passed — the email processor fetches the task,
  // signs the ack token, and sends via nodemailer.
  await addEmailJob({ taskId });

  return { status: "triggered", taskId };
};
