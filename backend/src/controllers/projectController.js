const projectService = require("../services/projectService");

exports.list = async (_req, res, next) => {
  try {
    const projects = await projectService.list();
    res.json(projects);
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
