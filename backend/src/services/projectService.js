const prisma = require("../config/prisma");
const { AppError } = require("../utils/errors");

async function list() {
  return prisma.project.findMany({
    orderBy: { createdAt: "asc" },
  });
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

module.exports = { list, getById, create };
