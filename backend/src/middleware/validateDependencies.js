const { canTaskExecute } = require("../services/dependencyService");

// Statuses that require all dependencies to be Completed before allowing
// the transition. Matches CLAUDE.md: "Task cannot start unless ALL
// dependencies are Completed."
const BLOCKED_WITHOUT_DEPS = new Set(["Triggered", "Acknowledged"]);

/**
 * Express middleware — runs at the API layer BEFORE the controller.
 * If the request is advancing a task to a status that requires dependency
 * completion, this middleware checks and rejects early with a 400.
 */
const validateDependencies = async (req, res, next) => {
  const targetStatus = req.body && req.body.status;

  // Only intercept status-advancing requests
  if (!targetStatus || !BLOCKED_WITHOUT_DEPS.has(targetStatus)) {
    return next();
  }

  const taskId = req.params.id;
  if (!taskId) {
    return next();
  }

  try {
    const result = await canTaskExecute(taskId);

    if (!result.executable) {
      return res.status(400).json({
        error: "Dependencies not satisfied",
        blockedBy: result.blockingTasks,
      });
    }

    // Attach to req so the service layer can skip re-querying
    req.dependencyCheck = result;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = validateDependencies;
