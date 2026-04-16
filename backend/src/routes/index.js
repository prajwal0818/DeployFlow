const { Router } = require("express");
const taskRoutes = require("./taskRoutes");
const authRoutes = require("./authRoutes");
const acknowledgeRoutes = require("./acknowledgeRoutes");
const scheduler = require("../services/schedulerService");

const router = Router();

router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
router.use("/acknowledge", acknowledgeRoutes);

router.get("/scheduler/status", (_req, res) => {
  res.json(scheduler.getStats());
});

// Manual trigger for testing — POST only
router.post("/scheduler/trigger", async (_req, res, next) => {
  try {
    await scheduler.tick();
    res.json(scheduler.getStats());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
