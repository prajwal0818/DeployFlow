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

// Graceful shutdown with 25s timeout (Docker sends SIGKILL after 30s)
const SHUTDOWN_TIMEOUT_MS = 25_000;

const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down worker`);

  const forceExit = setTimeout(() => {
    logger.error("Shutdown timed out — forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await Promise.all([
      taskWorker.close(),
      emailWorker.close(),
      emailProducer.close(),
    ]);
    await prisma.$disconnect();
    logger.info("Worker shut down cleanly");
    process.exit(0);
  } catch (err) {
    logger.error(err, "Error during worker shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (err) => {
  logger.error(err, "Unhandled rejection in worker");
});

process.on("uncaughtException", (err) => {
  logger.fatal(err, "Uncaught exception in worker — shutting down");
  shutdown("uncaughtException");
});
