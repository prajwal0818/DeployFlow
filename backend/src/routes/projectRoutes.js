const { Router } = require("express");
const projectController = require("../controllers/projectController");
const validate = require("../middleware/validate");
const { createProjectSchema } = require("../validators/projectValidator");
const auth = require("../middleware/auth");

const router = Router();

router.use(auth);

router.get("/", projectController.list);
router.get("/:id", projectController.getById);
router.post("/", validate(createProjectSchema), projectController.create);

module.exports = router;
