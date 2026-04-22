const projectService = require("../services/projectService");

exports.list = async (req, res, next) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await projectService.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const project = await projectService.getById(req.params.id);
    res.json(project);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const project = await projectService.create(req.body);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await projectService.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
