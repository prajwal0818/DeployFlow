const prisma = require("../config/prisma");

/**
 * Worker-layer dependency check.
 * Returns { executable, blockingTasks } — same contract as the backend's
 * dependencyService.canTaskExecute so all three layers (API, scheduler,
 * worker) validate consistently.
 */
async function canTaskExecute(taskId) {
  const dependencies = await prisma.taskDependency.findMany({
    where: { taskId },
    include: {
      dependsOn: {
        select: { id: true, taskName: true, status: true },
      },
    },
  });

  if (dependencies.length === 0) {
    return { executable: true, blockingTasks: [] };
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

module.exports = { canTaskExecute };
