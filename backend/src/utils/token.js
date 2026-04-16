const crypto = require("crypto");
const config = require("../config");

/**
 * Verify a signed acknowledgement token.
 *
 * Token format: base64url(payload).base64url(hmac)
 * Payload: { taskId, exp }
 *
 * Uses the same HMAC-SHA256 scheme as the worker's signAckToken().
 *
 * @param {string} taskId  - Expected task ID (from query param)
 * @param {string} token   - The signed token string
 * @returns {{ taskId: string, exp: number }}
 * @throws {Error} on invalid/expired/mismatched token
 */
function verifyAckToken(taskId, token) {
  if (!token || !token.includes(".")) {
    throw new Error("Malformed token");
  }

  const [payload, signature] = token.split(".");

  // Recompute HMAC and compare in constant time
  const expected = crypto
    .createHmac("sha256", config.ackTokenSecret)
    .update(payload)
    .digest("base64url");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    throw new Error("Invalid token signature");
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString());

  if (Date.now() > data.exp) {
    throw new Error("Token expired");
  }

  if (data.taskId !== taskId) {
    throw new Error("Token task ID mismatch");
  }

  return data;
}

module.exports = { verifyAckToken };
