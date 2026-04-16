const { Worker } = require("bullmq");
const connection = require("../config/redis");
const logger = require("../config/logger");
const taskProcessor = require("../processors/taskProcessor");

const taskWorker = new Worker("task-queue", taskProcessor, {
  connection,
  concurrency: 5,
});

taskWorker.on("completed", (job, result) => {
  logger.info(
    { jobId: job.id, taskId: job.data.taskId, result },
    "Task job completed"
  );
});

taskWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, taskId: job?.data?.taskId, err: err.message, attempts: job?.attemptsMade },
    "Task job failed"
  );
});

module.exports = { taskWorker };
