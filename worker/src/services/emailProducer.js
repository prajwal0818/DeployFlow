const { Queue } = require("bullmq");
const config = require("../config");
const logger = require("../config/logger");

const emailQueue = new Queue("email-queue", {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
});

/**
 * Enqueue an email job. Called by the task processor after transitioning
 * a task to Triggered.
 *
 * jobId = "email-{taskId}-triggered" ensures exactly-once per task
 * per trigger event — BullMQ silently ignores duplicates.
 */
async function addEmailJob(data) {
  const jobId = `email-${data.taskId}-triggered`;

  await emailQueue.add("send-email", data, {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 7 * 86400 },
  });

  logger.info({ jobId, taskId: data.taskId }, "Email job enqueued by worker");
}

async function close() {
  await emailQueue.close();
}

module.exports = { addEmailJob, close };
