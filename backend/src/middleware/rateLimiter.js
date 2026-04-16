const redis = require("../config/redis");
const logger = require("../config/logger");

/**
 * Redis sliding-window rate limiter.
 *
 * Uses a sorted set per key. Each request adds a timestamped member;
 * expired members are pruned on every check.
 *
 * @param {{ windowMs?: number, max?: number, keyPrefix?: string }} opts
 */
function rateLimiter({ windowMs = 60_000, max = 10, keyPrefix = "rl" } = {}) {
  return async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    try {
      const pipe = redis.pipeline();
      pipe.zremrangebyscore(key, 0, now - windowMs); // prune expired
      pipe.zadd(key, now, `${now}:${Math.random()}`); // record this request
      pipe.zcard(key); // count requests in window
      pipe.pexpire(key, windowMs); // auto-cleanup

      const results = await pipe.exec();
      const count = results[2][1]; // zcard result

      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));

      if (count > max) {
        logger.warn({ ip, count, max, key }, "Rate limit exceeded");
        return res.status(429).json({ error: "Too many requests, try again later" });
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request through (fail-open)
      logger.error(err, "Rate limiter Redis error — failing open");
      next();
    }
  };
}

module.exports = rateLimiter;
