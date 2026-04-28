const INSECURE_DEFAULTS = [
  "change-me-in-production",
  "dev-ack-secret-change-in-production",
];

const isProduction = process.env.NODE_ENV === "production";

const ackTokenSecret =
  process.env.ACK_TOKEN_SECRET || "dev-ack-secret-change-in-production";

if (isProduction) {
  if (!ackTokenSecret || INSECURE_DEFAULTS.includes(ackTokenSecret)) {
    throw new Error(
      "FATAL: ACK_TOKEN_SECRET is missing or using an insecure default. Set a strong secret in production."
    );
  }
}

module.exports = {
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
  email: {
    domain: process.env.EMAIL_DOMAIN || "tilli.pro",
    fromAddress: process.env.EMAIL_FROM_ADDRESS || null, // null = construct from domain
    fromName: process.env.EMAIL_FROM_NAME || "DeployFlow",
    fallbackTeam: process.env.EMAIL_FALLBACK_TEAM || "ops",
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  ackTokenSecret,
  ackTokenExpiryMs:
    parseInt(process.env.ACK_TOKEN_EXPIRY_MS, 10) || 7 * 24 * 60 * 60 * 1000, // 7 days
};
