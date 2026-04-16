const { Worker } = require("bullmq");
const connection = require("../config/redis");
const logger = require("../config/logger");
const emailProcessor = require("../processors/emailProcessor");

const emailWorker = new Worker("email-queue", emailProcessor, {
  connection,
  concurrency: 3,
});

emailWorker.on("completed", (job, result) => {
  logger.info(
    { jobId: job.id, taskId: job.data.taskId, result },
    "Email job completed"
  );
});

emailWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, taskId: job?.data?.taskId, err: err.message, attempts: job?.attemptsMade },
    "Email job failed"
  );
});

module.exports = { emailWorker };
