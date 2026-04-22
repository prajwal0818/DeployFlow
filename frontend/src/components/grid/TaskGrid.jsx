import React, { useCallback, useRef, useMemo, useContext, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { columnDefs } from "./columnDefs";
import { useTaskData } from "../../hooks/useTaskData";
import { ProjectContext } from "../../App";
import { toast } from "../ui/Toast";

export default function TaskGrid() {
  const gridRef = useRef(null);
  const { selectedProjectId } = useContext(ProjectContext);
  const { tasks, loading, error, addTask, updateTask, deleteTask, fetchTasks } =
    useTaskData(selectedProjectId);

  // ── Per-row debounced updates ──────────────────────────────────────────────
  const pendingUpdates = useRef({});
  const timers = useRef({});

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  const flushUpdate = useCallback(
    async (rowId) => {
      const payload = pendingUpdates.current[rowId];
      if (!payload) return;
      delete pendingUpdates.current[rowId];

      try {
        await updateTask(rowId, payload);
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        toast(`Update failed: ${msg}`);
        // Refetch to reset grid state after failed update
        fetchTasks();
      }
    },
    [updateTask, fetchTasks]
  );

  const onCellValueChanged = useCallback(
    (event) => {
      const { data, colDef, newValue } = event;
      const rowId = data.id;
      const field = colDef.field;

      // Skip if no actual change (e.g. ESC or same value)
      if (event.oldValue === event.newValue) return;

      // Accumulate changes for this row
      if (!pendingUpdates.current[rowId]) {
        pendingUpdates.current[rowId] = {};
      }
      pendingUpdates.current[rowId][field] = newValue;

      // Debounce per row (400ms)
      clearTimeout(timers.current[rowId]);
      timers.current[rowId] = setTimeout(() => flushUpdate(rowId), 400);
    },
    [flushUpdate]
  );

  // ── Add Task ───────────────────────────────────────────────────────────────
  const handleAddTask = useCallback(async () => {
    if (!selectedProjectId) {
      toast("Please select a project first.", "warning");
      return;
    }
    try {
      const created = await addTask({
        system: "FOL",
        taskName: "New Task",
        projectId: selectedProjectId,
      });
      // Scroll to new row and start editing
      setTimeout(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const rowNode = api.getRowNode(created.id);
        if (rowNode) {
          api.ensureNodeVisible(rowNode, "bottom");
          api.startEditingCell({
            rowIndex: rowNode.rowIndex,
            colKey: "taskName",
          });
        }
      }, 100);
    } catch (err) {
      toast(`Failed to add task: ${err.response?.data?.error || err.message}`);
    }
  }, [addTask, selectedProjectId]);

  // ── Delete Selected ────────────────────────────────────────────────────────
  const handleDeleteSelected = useCallback(async () => {
    const selected = gridRef.current?.api?.getSelectedRows();
    if (!selected || selected.length === 0) {
      toast("Select one or more rows first.", "warning");
      return;
    }

    if (!window.confirm(`Delete ${selected.length} task(s)?`)) return;

    for (const row of selected) {
      try {
        await deleteTask(row.id);
      } catch (err) {
        toast(
          `Failed to delete "${row.taskName}": ${err.response?.data?.error || err.message}`
        );
      }
    }
  }, [deleteTask]);

  // ── Grid Config ────────────────────────────────────────────────────────────
  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  );

  const getRowId = useCallback((params) => params.data.id, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a project to view tasks.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchTasks}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white">
        <button
          onClick={handleAddTask}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          + Add Task
        </button>
        <button
          onClick={handleDeleteSelected}
          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
        >
          Delete Selected
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid — explicit flex:1 + min-height:0 ensures AG Grid fills the
           remaining space without overflowing in a flex column layout */}
      <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowData={tasks}
          getRowId={getRowId}
          rowSelection="multiple"
          onCellValueChanged={onCellValueChanged}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          undoRedoCellEditing
          undoRedoCellEditingLimit={20}
          animateRows
        />
      </div>
    </div>
  );
}
