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
  const maxAttempts = job?.opts?.attempts || 5;
  const isFinal = job?.attemptsMade >= maxAttempts;

  logger.error(
    { jobId: job?.id, taskId: job?.data?.taskId, err: err.message, attempts: job?.attemptsMade, final: isFinal },
    isFinal ? "Email job permanently failed — no more retries" : "Email job failed"
  );
});

module.exports = { emailWorker };
