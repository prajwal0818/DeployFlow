const { z } = require("zod");

const VALID_STATUSES = [
  "Pending",
  "Triggered",
  "Acknowledged",
  "Completed",
  "Blocked",
];

const createTaskSchema = z.object({
  system: z.string().min(1, "system is required"),
  taskName: z.string().min(1, "taskName is required"),
  description: z.string().optional(),
  assignedTeam: z.string().optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
  plannedStartTime: z.coerce.date().optional().nullable(),
  plannedEndTime: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  projectId: z.string().uuid("projectId is required"),
  dependencies: z.array(z.string().uuid()).optional().default([]),
});

const updateTaskSchema = z.object({
  system: z.string().min(1).optional(),
  taskName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  assignedTeam: z.string().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  plannedStartTime: z.coerce.date().optional().nullable(),
  plannedEndTime: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(VALID_STATUSES).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
});

module.exports = { createTaskSchema, updateTaskSchema, VALID_STATUSES };
