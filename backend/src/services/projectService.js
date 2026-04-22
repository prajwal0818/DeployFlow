const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { AppError } = require("../utils/errors");

async function list(filters = {}) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 100));
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.project.count(),
  ]);

  return { data: projects, total, page, limit };
}

async function getById(id) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new AppError("Project not found", 404);
  }
  return project;
}

async function create(data) {
  const existing = await prisma.project.findUnique({ where: { code: data.code } });
  if (existing) {
    throw new AppError("Project code already exists", 409);
  }
  return prisma.project.create({ data });
}

async function remove(id) {
  const existing = await prisma.project.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError("Project not found", 404);
  }

  await prisma.project.delete({ where: { id } });

  logger.info({ projectId: id, projectCode: existing.code }, "Project deleted");
}

module.exports = { list, getById, create, remove };
