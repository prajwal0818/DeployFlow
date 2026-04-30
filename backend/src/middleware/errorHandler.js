const { ZodError } = require("zod");
const logger = require("../config/logger");
const { AppError } = require("../utils/errors");

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, _next) => {
  if (err instanceof AppError) {
    logger.warn({ status: err.status, message: err.message }, "App error");
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    const messages = err.issues.map((i) => i.message);
    return res.status(400).json({ error: messages.join(", ") });
  }

  logger.error(err, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
};
