const { z } = require("zod");

const createProjectSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  code: z
    .string()
    .min(1, "code is required")
    .max(20)
    .regex(
      /^[A-Z0-9][A-Z0-9_-]*$/,
      "code must contain only uppercase letters, digits, hyphens, and underscores"
    ),
  description: z.string().max(1000).optional(),
});

module.exports = { createProjectSchema };
