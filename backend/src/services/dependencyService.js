const prisma = require("../config/prisma");
const { AppError } = require("../utils/errors");

// ── canTaskExecute ──────────────────────────────────────────────────────────
// Core reusable function: checks whether ALL dependencies of a task
// have status "Completed". Returns a structured result usable by
// API middleware, service layer, scheduler, and worker.

async function canTaskExecute(taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  const dependencies = await prisma.taskDependency.findMany({
    where: { taskId },
    include: {
      dependsOn: {
        select: { id: true, taskName: true, status: true, projectId: true },
      },
    },
  });

  if (dependencies.length === 0) {
    return { executable: true, blockingTasks: [] };
  }

  // Validate all dependencies are within the same project
  for (const dep of dependencies) {
    if (dep.dependsOn.projectId !== task.projectId) {
      throw new AppError("Cross-project dependencies are not allowed", 400);
    }
  }

  const blockingTasks = dependencies
    .filter((dep) => dep.dependsOn.status !== "Completed")
    .map((dep) => ({
      id: dep.dependsOn.id,
      taskName: dep.dependsOn.taskName,
      status: dep.dependsOn.status,
    }));

  return {
    executable: blockingTasks.length === 0,
    blockingTasks,
  };
}

// ── assertDependenciesMet ───────────────────────────────────────────────────
// Throws if any dependency is not Completed. Use as a guard in service /
// worker code where you want a hard failure.

async function assertDependenciesMet(taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  const dependencies = await prisma.taskDependency.findMany({
    where: { taskId },
    include: {
      dependsOn: {
        select: { id: true, taskName: true, status: true, projectId: true },
      },
    },
  });

  // Validate all dependencies are within the same project
  for (const dep of dependencies) {
    if (dep.dependsOn.projectId !== task.projectId) {
      throw new AppError("Cross-project dependencies are not allowed", 400);
    }
  }

  const blockingTasks = dependencies
    .filter((dep) => dep.dependsOn.status !== "Completed")
    .map((dep) => ({
      taskName: dep.dependsOn.taskName,
      status: dep.dependsOn.status,
    }));

  if (blockingTasks.length > 0) {
    const names = blockingTasks
      .map((t) => `${t.taskName} (${t.status})`)
      .join(", ");
    throw new AppError(
      `Dependencies not completed: ${names}`,
      400
    );
  }
}

// ── wouldCreateCycle ────────────────────────────────────────────────────────
// Detect circular dependencies using iterative DFS.
// Loads the FULL dependency graph in a single query, then walks in-memory.
// Checks: if we add edges  taskId → each targetId, would taskId become
// reachable from itself?

async function wouldCreateCycle(taskId, targetIds) {
  if (targetIds.length === 0) return false;
  if (targetIds.includes(taskId)) return true;

  // Load entire graph once — much faster than per-node queries
  const allEdges = await prisma.taskDependency.findMany({
    select: { taskId: true, dependsOnTaskId: true },
  });

  // Build adjacency list:  child → [parents it depends on]
  const adjList = new Map();
  for (const edge of allEdges) {
    if (!adjList.has(edge.taskId)) {
      adjList.set(edge.taskId, []);
    }
    adjList.get(edge.taskId).push(edge.dependsOnTaskId);
  }

  // DFS: starting from each targetId, walk existing "dependsOn" edges.
  // If we reach taskId, adding taskId → targetId creates a cycle.
  const visited = new Set();
  const stack = [...targetIds];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}

// ── validateDependenciesExist ───────────────────────────────────────────────

async function validateDependenciesExist(dependencyIds) {
  if (dependencyIds.length === 0) return;

  const found = await prisma.task.findMany({
    where: { id: { in: dependencyIds } },
    select: { id: true },
  });

  const foundIds = new Set(found.map((t) => t.id));
  const missing = dependencyIds.filter((id) => !foundIds.has(id));

  if (missing.length > 0) {
    throw new AppError(
      `Dependency tasks not found: ${missing.join(", ")}`,
      400
    );
  }
}

// ── setDependencies ─────────────────────────────────────────────────────────
// Replace all dependencies for a task with a new set.
// Validates: existence, self-reference, circular reference, same project.

async function setDependencies(taskId, dependencyIds) {
  const unique = [...new Set(dependencyIds)];

  // Self-dependency check
  if (unique.includes(taskId)) {
    throw new AppError("A task cannot depend on itself", 400);
  }

  if (unique.length > 0) {
    await validateDependenciesExist(unique);

    // Cross-project check: all deps must be in the same project as the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const depTasks = await prisma.task.findMany({
      where: { id: { in: unique } },
      select: { id: true, projectId: true },
    });

    for (const dep of depTasks) {
      if (dep.projectId !== task.projectId) {
        throw new AppError("Cross-project dependencies are not allowed", 400);
      }
    }

    if (await wouldCreateCycle(taskId, unique)) {
      throw new AppError("Circular dependency detected", 400);
    }
  }

  await prisma.$transaction([
    prisma.taskDependency.deleteMany({ where: { taskId } }),
    ...unique.map((depId) =>
      prisma.taskDependency.create({
        data: { taskId, dependsOnTaskId: depId },
      })
    ),
  ]);
}

// ── getDependers ────────────────────────────────────────────────────────────
// Returns tasks that depend ON the given taskId (downstream impact).

async function getDependers(taskId) {
  const rows = await prisma.taskDependency.findMany({
    where: { dependsOnTaskId: taskId },
    include: {
      task: {
        select: { id: true, taskName: true, status: true },
      },
    },
  });

  return rows.map((r) => r.task);
}

module.exports = {
  canTaskExecute,
  assertDependenciesMet,
  wouldCreateCycle,
  validateDependenciesExist,
  setDependencies,
  getDependers,
};
