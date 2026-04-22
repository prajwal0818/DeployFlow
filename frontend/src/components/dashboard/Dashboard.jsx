import React, { useContext } from "react";
import { useTaskData } from "../../hooks/useTaskData";
import { useNavigate } from "react-router-dom";
import { ProjectContext } from "../../App";
import { STATUS_CARD_COLORS } from "../../utils/constants";

const statusColors = STATUS_CARD_COLORS;

function StatCard({ label, count, colorClass, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`border rounded-lg p-5 text-left transition-shadow hover:shadow-md ${colorClass}`}
    >
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </button>
  );
}

export default function Dashboard() {
  const { selectedProjectId } = useContext(ProjectContext);
  const { tasks, loading, error, fetchTasks } = useTaskData(selectedProjectId);
  const navigate = useNavigate();

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a project to view the dashboard.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading dashboard...
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

  const counts = {
    Pending: 0,
    Triggered: 0,
    Acknowledged: 0,
    Completed: 0,
    Blocked: 0,
  };
  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
  });

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 8);

  return (
    <div className="p-6 overflow-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Overview</h2>
        <p className="text-sm text-gray-500 mt-1">{tasks.length} total tasks</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {Object.entries(counts).map(([status, count]) => (
          <StatCard
            key={status}
            label={status}
            count={count}
            colorClass={statusColors[status] || "bg-gray-100 text-gray-800 border-gray-300"}
            onClick={() => navigate("/tasks")}
          />
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Tasks</h3>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Task</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">System</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Team</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Planned Start</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentTasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {task.project?.code}-{task.sequenceNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{task.taskName}</td>
                  <td className="px-4 py-3 text-gray-600">{task.system}</td>
                  <td className="px-4 py-3 text-gray-600">{task.assignedTeam || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status] || ""}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {task.plannedStartTime
                      ? new Date(task.plannedStartTime).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
              {recentTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No tasks yet. Go to Tasks to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
