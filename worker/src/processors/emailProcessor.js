const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { sendEmail } = require("../services/emailService");

/**
 * email-queue processor.
 *
 * Flow:
 *   1. Fetch task from DB (with assignedUser for email address)
 *   2. Idempotency: skip if task no longer Triggered
 *   3. Call sendEmail(task) — signs ack token, builds email, sends via nodemailer
 *   4. Audit log
 *
 * Retries are handled by BullMQ (5 attempts, exponential backoff).
 * The jobId "email-{taskId}-triggered" prevents duplicate enqueues.
 * The status check here prevents duplicate sends on retry after partial failure.
 */
module.exports = async (job) => {
  const { taskId } = job.data;
  const log = logger.child({ jobId: job.id, taskId });

  log.info("Processing email job");

  // ── 1. Fetch task ────────────────────────────────────────────────────
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedUser: { select: { id: true, email: true, name: true } },
    },
  });

  if (!task) {
    log.warn("Task not found — skipping email");
    return { status: "skipped", reason: "task_not_found" };
  }

  // ── 2. Idempotency ──────────────────────────────────────────────────
  if (task.status !== "Triggered") {
    log.info(
      { currentStatus: task.status },
      "Task no longer in Triggered state — skipping email"
    );
    return { status: "skipped", reason: "status_moved_on" };
  }

  // ── 3. Send email ───────────────────────────────────────────────────
  const to =
    task.assignedUser?.email ||
    `${task.assignedTeam || "ops"}@company.com`;

  const result = await sendEmail(task);

  // ── 4. Audit (best-effort — don't retry the whole job if only audit fails) ──
  try {
    await prisma.auditLog.create({
      data: {
        taskId,
        action: "EMAIL_SENT",
        field: null,
        oldValue: null,
        newValue: `to=${to} messageId=${result.messageId}`,
      },
    });
  } catch (auditErr) {
    log.error(
      { err: auditErr.message, messageId: result.messageId },
      "Email sent but audit log write failed"
    );
  }

  log.info({ messageId: result.messageId }, "Email sent successfully");

  return { status: "sent", messageId: result.messageId };
};
