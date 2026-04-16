const { Router } = require("express");
const acknowledgeController = require("../controllers/acknowledgeController");
const rateLimiter = require("../middleware/rateLimiter");

const router = Router();

// Public endpoint (no JWT auth) — protected by signed token + rate limiting.
// 15 requests per IP per minute to prevent brute-force token guessing.
router.get(
  "/",
  rateLimiter({ windowMs: 60_000, max: 15, keyPrefix: "rl:ack" }),
  acknowledgeController.acknowledge
);

module.exports = router;
