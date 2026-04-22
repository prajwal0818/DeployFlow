-- CreateIndex
CREATE INDEX "tasks_status_planned_start_time_idx" ON "tasks"("status", "planned_start_time");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
