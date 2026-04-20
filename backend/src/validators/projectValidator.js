const { z } = require("zod");

const createProjectSchema = z.object({
  name: z.string().min(1, "name is required"),
  code: z.string().min(1, "code is required").max(20),
  description: z.string().optional(),
});

module.exports = { createProjectSchema };
