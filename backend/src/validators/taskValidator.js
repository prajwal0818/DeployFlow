const { z } = require("zod");

const VALID_STATUSES = [
  "Pending",
  "Triggered",
  "Acknowledged",
  "Completed",
  "Blocked",
];

const createTaskSchema = z.object({
  system: z.string().min(1, "system is required").max(50),
  taskName: z.string().min(1, "taskName is required").max(200),
  description: z.string().max(5000).optional(),
  assignedTeam: z.string().max(100).optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
  plannedStartTime: z.coerce.date().optional().nullable(),
  plannedEndTime: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional(),
  projectId: z.string().uuid("projectId is required"),
  dependencies: z.array(z.string().uuid()).optional().default([]),
});

const updateTaskSchema = z.object({
  system: z.string().min(1).max(50).optional(),
  taskName: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  assignedTeam: z.string().max(100).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  plannedStartTime: z.coerce.date().optional().nullable(),
  plannedEndTime: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(VALID_STATUSES).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
});

module.exports = { createTaskSchema, updateTaskSchema, VALID_STATUSES };
