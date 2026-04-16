const app = require("./src/app");
const config = require("./src/config");
const logger = require("./src/config/logger");
const prisma = require("./src/config/prisma");
const scheduler = require("./src/services/schedulerService");
const queueService = require("./src/services/queueService");

const PORT = config.apiPort;

const server = app.listen(PORT, () => {
  logger.info(`DeployFlow API running on port ${PORT}`);
  scheduler.start();
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down`);
  scheduler.stop();
  server.close(async () => {
    await queueService.close();
    await prisma.$disconnect();
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
