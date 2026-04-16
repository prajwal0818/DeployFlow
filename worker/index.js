require("dotenv").config();
const logger = require("./src/config/logger");
const prisma = require("./src/config/prisma");
const { taskWorker } = require("./src/queues/taskQueue");
const { emailWorker } = require("./src/queues/emailQueue");
const emailProducer = require("./src/services/emailProducer");

logger.info("DeployFlow worker started");
logger.info(
  { queues: ["task-queue", "email-queue"] },
  "Listening for jobs"
);

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down worker`);
  await taskWorker.close();
  await emailWorker.close();
  await emailProducer.close();
  await prisma.$disconnect();
  logger.info("Worker shut down cleanly");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (err) => {
  logger.error(err, "Unhandled rejection in worker");
});
