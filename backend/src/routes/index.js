const { Router } = require("express");
const taskRoutes = require("./taskRoutes");
const authRoutes = require("./authRoutes");
const acknowledgeRoutes = require("./acknowledgeRoutes");
const projectRoutes = require("./projectRoutes");
const auth = require("../middleware/auth");
const scheduler = require("../services/schedulerService");

const router = Router();

router.use("/auth", authRoutes);
router.use("/tasks", taskRoutes);
router.use("/projects", projectRoutes);
router.use("/acknowledge", acknowledgeRoutes);

router.get("/scheduler/status", auth, (_req, res) => {
  res.json(scheduler.getStats());
});

// Manual trigger for testing — POST only
router.post("/scheduler/trigger", auth, async (_req, res, next) => {
  try {
    await scheduler.tick();
    res.json(scheduler.getStats());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
