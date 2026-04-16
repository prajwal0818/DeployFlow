const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { verifyAckToken } = require("../utils/token");
const { canTaskExecute } = require("../services/dependencyService");

/**
 * GET /acknowledge?task_id=ID&token=SIGNED_TOKEN
 *
 * Acknowledgement flow (per CLAUDE.md):
 *   1. Validate signed token (HMAC-SHA256, expiry, taskId match)
 *   2. Fetch task
 *   3. Idempotency check
 *   4. Transition Triggered → Acknowledged + set actual_start_time
 *   5. Audit log (in a transaction)
 */
exports.acknowledge = async (req, res, next) => {
  try {
    const { task_id: taskId, token } = req.query;

    if (!taskId || !token) {
      return res.status(400).json({ error: "Missing task_id or token" });
    }

    // ── 1. Verify token ──────────────────────────────────────────────────
    try {
      verifyAckToken(taskId, token);
    } catch (err) {
      logger.warn({ taskId, reason: err.message }, "Ack token rejected");
      return res.status(403).json({ error: err.message });
    }

    // ── 2. Fetch task ────────────────────────────────────────────────────
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        taskName: true,
        actualStartTime: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // ── 3. Idempotency ──────────────────────────────────────────────────
    // Already acknowledged or further along — return success (idempotent).
    if (task.status === "Acknowledged" || task.status === "Completed") {
      return res.status(200).json({
        message: `Task already ${task.status.toLowerCase()}`,
        taskId: task.id,
        taskName: task.taskName,
        status: task.status,
        actualStartTime: task.actualStartTime,
      });
    }

    // Only Triggered tasks can be acknowledged.
    if (task.status !== "Triggered") {
      return res.status(409).json({
        error: `Cannot acknowledge — task is ${task.status}`,
        currentStatus: task.status,
      });
    }

    // ── 3b. Dependency gate ────────────────────────────────────────────
    // Re-verify dependencies haven't reverted since the task was triggered.
    const depCheck = await canTaskExecute(taskId);
    if (!depCheck.executable) {
      const blockers = depCheck.blockingTasks
        .map((t) => `${t.taskName} (${t.status})`)
        .join(", ");
      logger.warn({ taskId, blockers }, "Ack blocked — dependencies not met");
      return res.status(409).json({
        error: `Cannot acknowledge — dependencies not completed: ${blockers}`,
        blockingTasks: depCheck.blockingTasks,
      });
    }

    // ── 4. Transition + audit in a transaction ───────────────────────────
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: {
          status: "Acknowledged",
          actualStartTime: now,
        },
      });

      await tx.auditLog.createMany({
        data: [
          {
            taskId,
            action: "UPDATED",
            field: "status",
            oldValue: "Triggered",
            newValue: "Acknowledged",
          },
          {
            taskId,
            action: "UPDATED",
            field: "actualStartTime",
            oldValue: null,
            newValue: now.toISOString(),
          },
        ],
      });

      return result;
    });

    logger.info({ taskId, taskName: task.taskName }, "Task acknowledged");

    return res.status(200).json({
      message: "Task acknowledged successfully",
      taskId: updated.id,
      taskName: updated.taskName,
      status: updated.status,
      actualStartTime: updated.actualStartTime,
    });
  } catch (err) {
    next(err);
  }
};
