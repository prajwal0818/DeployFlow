const crypto = require("crypto");
const nodemailer = require("nodemailer");
const config = require("../config");
const logger = require("../config/logger");

// ── Transport ────────────────────────────────────────────────────────────────
// Real SMTP when credentials are configured, otherwise jsonTransport mock.
const transporter = config.smtp.host && config.smtp.user
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : nodemailer.createTransport({ jsonTransport: true });

const isMock = !config.smtp.host || !config.smtp.user;

// ── Signed acknowledgement tokens (HMAC-SHA256) ─────────────────────────────

/**
 * Sign an acknowledgement token for a task.
 * Format: base64url(payload).base64url(hmac)
 * Payload: { taskId, exp }
 */
function signAckToken(taskId) {
  const payload = Buffer.from(
    JSON.stringify({
      taskId,
      exp: Date.now() + config.ackTokenExpiryMs,
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", config.ackTokenSecret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

/**
 * Build the acknowledgement URL for a task.
 */
function buildAckUrl(taskId) {
  const token = signAckToken(taskId);
  return `${config.frontendUrl}/acknowledge?task_id=${taskId}&token=${token}`;
}

// ── Email building ───────────────────────────────────────────────────────────

function buildTaskEmailHtml(task, ackUrl) {
  return [
    `<h2>Task Triggered: ${task.taskName}</h2>`,
    `<p><strong>System:</strong> ${task.system}</p>`,
    `<p><strong>Team:</strong> ${task.assignedTeam || "Unassigned"}</p>`,
    task.description
      ? `<p><strong>Description:</strong> ${task.description}</p>`
      : "",
    `<br/>`,
    `<p><a href="${ackUrl}" style="padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;">Acknowledge Task</a></p>`,
    `<p style="color:#666;font-size:12px;">Or copy this link: ${ackUrl}</p>`,
  ].join("\n");
}

// ── Main interface ───────────────────────────────────────────────────────────

/**
 * sendEmail(task)
 *
 * Main entry point. Builds the acknowledgement link with a signed token,
 * composes the notification email, and sends it via nodemailer.
 *
 * @param {object} task  - Task record from DB (must include id, taskName,
 *                         system, assignedTeam, description, assignedUser)
 * @returns {{ messageId: string }}
 */
async function sendEmail(task) {
  const to =
    task.assignedUser?.email ||
    `${task.assignedTeam || config.email.fallbackTeam}@${config.email.domain}`;
  const subject = `[DeployFlow] Task triggered: ${task.taskName}`;
  const ackUrl = buildAckUrl(task.id);
  const html = buildTaskEmailHtml(task, ackUrl);

  const fromAddress = config.email.fromAddress || `noreply@${config.email.domain}`;
  const info = await transporter.sendMail({
    from: `"${config.email.fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });

  const messageId = isMock ? info.messageId || info.envelope?.messageId || `mock-${Date.now()}` : info.messageId;

  logger.info(
    { to, subject, messageId, mock: isMock },
    isMock ? "MOCK EMAIL SENT" : "EMAIL SENT"
  );

  return { messageId };
}

module.exports = { sendEmail, signAckToken, buildAckUrl, transporter };
