const taskService = require("../services/taskService");
const {
  canTaskExecute,
  getDependers,
} = require("../services/dependencyService");

exports.list = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      system: req.query.system,
      assignedUserId: req.query.assignedUserId,
      projectId: req.query.projectId,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await taskService.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const task = await taskService.getById(req.params.id);
    res.json(task);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    if (!req.body.projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    const task = await taskService.create(req.body, { userId: req.user?.id || null });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    // If the API middleware already validated dependencies, tell the
    // service layer so it can skip the redundant DB query.
    const opts = {
      dependencyPreChecked: !!req.dependencyCheck,
      userId: req.user?.id || null,
    };
    const task = await taskService.update(req.params.id, req.body, opts);
    res.json(task);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await taskService.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// GET /tasks/:id/dependencies — full dependency status for a task
exports.getDependencyStatus = async (req, res, next) => {
  try {
    const taskId = req.params.id;

    // Verify task exists
    await taskService.getById(taskId);

    const executionCheck = await canTaskExecute(taskId);
    const dependers = await getDependers(taskId);

    res.json({
      taskId,
      ...executionCheck,
      dependedOnBy: dependers,
    });
  } catch (err) {
    next(err);
  }
};
