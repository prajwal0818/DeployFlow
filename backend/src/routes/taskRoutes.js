const { Router } = require("express");
const taskController = require("../controllers/taskController");
const validate = require("../middleware/validate");
const validateDependencies = require("../middleware/validateDependencies");
const {
  createTaskSchema,
  updateTaskSchema,
} = require("../validators/taskValidator");
const auth = require("../middleware/auth");

const router = Router();

router.use(auth);

router.get("/", taskController.list);
router.get("/:id", taskController.getById);
router.get("/:id/dependencies", taskController.getDependencyStatus);
router.post("/", validate(createTaskSchema), taskController.create);
router.put(
  "/:id",
  validate(updateTaskSchema),
  validateDependencies,
  taskController.update
);
router.delete("/:id", taskController.remove);

module.exports = router;
