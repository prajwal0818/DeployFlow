require("dotenv").config();

module.exports = {
  apiPort: process.env.API_PORT || 3001,
  jwtSecret: process.env.JWT_SECRET,
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  ackTokenSecret:
    process.env.ACK_TOKEN_SECRET || "dev-ack-secret-change-in-production",
};
