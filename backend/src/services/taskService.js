const prisma = require("../config/prisma");
const { AppError } = require("../utils/errors");
const {
  setDependencies,
  assertDependenciesMet,
} = require("./dependencyService");
const logger = require("../config/logger");

const TASK_INCLUDE = {
  dependsOn: {
    select: { dependsOnTaskId: true },
  },
  assignedUser: {
    select: { id: true, name: true, email: true },
  },
  project: {
    select: { id: true, code: true, name: true },
  },
};

function formatTask(task) {
  return {
    ...task,
    dependencies: task.dependsOn
      ? task.dependsOn.map((d) => d.dependsOnTaskId)
      : [],
    dependsOn: undefined,
  };
}

// ── List ────────────────────────────────────────────────────────────────────

async function list(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.system) {
    where.system = filters.system;
  }
  if (filters.assignedUserId) {
    where.assignedUserId = filters.assignedUserId;
  }
  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy: { sequenceNumber: "asc" },
  });

  return tasks.map(formatTask);
}

// ── Get by ID ───────────────────────────────────────────────────────────────

async function getById(id) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: TASK_INCLUDE,
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  return formatTask(task);
}

// ── Create ──────────────────────────────────────────────────────────────────

async function create(data) {
  const { dependencies, ...taskData } = data;

  if (!taskData.projectId) {
    throw new AppError("projectId is required", 400);
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: taskData.projectId },
  });
  if (!project) {
    throw new AppError("Project not found", 404);
  }

  // Generate sequenceNumber atomically within a transaction
  const task = await prisma.$transaction(async (tx) => {
    const lastTask = await tx.task.findFirst({
      where: { projectId: taskData.projectId },
      orderBy: { sequenceNumber: "desc" },
    });

    const nextSeq = (lastTask?.sequenceNumber || 0) + 1;

    return tx.task.create({
      data: {
        ...taskData,
        sequenceNumber: nextSeq,
      },
      include: TASK_INCLUDE,
    });
  });

  await writeAuditLog(task.id, "CREATED", null, null, null);

  if (dependencies && dependencies.length > 0) {
    await setDependencies(task.id, dependencies);
    await writeAuditLog(
      task.id,
      "UPDATED",
      "dependencies",
      null,
      dependencies.join(",")
    );
    return getById(task.id);
  }

  return formatTask(task);
}

// ── Update ──────────────────────────────────────────────────────────────────

async function update(id, data, opts = {}) {
  const existing = await prisma.task.findUnique({
    where: { id },
    include: TASK_INCLUDE,
  });

  if (!existing) {
    throw new AppError("Task not found", 404);
  }

  if (existing.status === "Completed") {
    throw new AppError("Cannot modify a completed task", 400);
  }

  const { dependencies, ...taskFields } = data;

  // Prevent changing projectId after creation
  if (taskFields.projectId && taskFields.projectId !== existing.projectId) {
    throw new AppError("Cannot change projectId after task creation", 400);
  }
  // Remove projectId from update payload to be safe
  delete taskFields.projectId;

  // Validate status transition
  if (taskFields.status && taskFields.status !== existing.status) {
    validateStatusTransition(existing.status, taskFields.status);

    // Defense-in-depth: verify dependency completion for advancing statuses.
    // The API middleware already checks, but the service layer must enforce
    // independently (scheduler and worker also call this service).
    if (STATUS_REQUIRES_DEPS_MET.has(taskFields.status)) {
      // Skip re-query if middleware already validated
      if (!opts.dependencyPreChecked) {
        await assertDependenciesMet(id);
      }
    }
  }

  // Build audit entries for changed fields
  const auditEntries = [];
  for (const [key, value] of Object.entries(taskFields)) {
    const oldVal = existing[key];
    if (oldVal !== value && value !== undefined) {
      auditEntries.push({
        taskId: id,
        action: "UPDATED",
        field: key,
        oldValue: oldVal == null ? null : String(oldVal),
        newValue: value == null ? null : String(value),
      });
    }
  }

  // Apply update + audit in a transaction
  const hasFieldUpdates = Object.keys(taskFields).length > 0;

  await prisma.$transaction(async (tx) => {
    if (hasFieldUpdates) {
      await tx.task.update({ where: { id }, data: taskFields });
    }
    if (auditEntries.length > 0) {
      await tx.auditLog.createMany({ data: auditEntries });
    }
  });

  // Handle dependency changes outside the transaction (has its own)
  if (dependencies !== undefined) {
    const oldDeps = existing.dependsOn.map((d) => d.dependsOnTaskId).sort();
    const newDeps = [...dependencies].sort();
    const changed =
      oldDeps.length !== newDeps.length ||
      oldDeps.some((v, i) => v !== newDeps[i]);

    if (changed) {
      await setDependencies(id, dependencies);
      await writeAuditLog(
        id,
        "UPDATED",
        "dependencies",
        oldDeps.join(",") || null,
        newDeps.join(",") || null
      );
    }
  }

  return getById(id);
}

// ── Delete ──────────────────────────────────────────────────────────────────

async function remove(id) {
  const existing = await prisma.task.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError("Task not found", 404);
  }

  await prisma.task.delete({ where: { id } });

  logger.info({ taskId: id }, "Task deleted");
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  Pending: ["Triggered", "Blocked"],
  Blocked: ["Pending"],
  Triggered: ["Acknowledged"],
  Acknowledged: ["Completed"],
  Completed: [],
};

// Statuses that cannot be entered unless ALL dependencies are Completed
const STATUS_REQUIRES_DEPS_MET = new Set(["Triggered", "Acknowledged"]);

function validateStatusTransition(current, next) {
  if (current === next) return;

  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppError(
      `Invalid status transition: ${current} -> ${next}`,
      400
    );
  }
}

async function writeAuditLog(taskId, action, field, oldValue, newValue) {
  await prisma.auditLog.create({
    data: { taskId, action, field, oldValue, newValue },
  });
}

module.exports = { list, getById, create, update, remove };
