import React, { useContext, useState } from "react";
import { ProjectContext } from "../../App";

export default function Projects() {
  const { projects, selectedProjectId, setSelectedProjectId, refreshProjects } =
    useContext(ProjectContext);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await refreshProjects({ name, code, description });
      setSelectedProjectId(created.id);
      setName("");
      setCode("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Project
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border rounded-lg p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-gray-800">
            Create New Project
          </h3>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Release"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. Q4-REL"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Project"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Project List */}
      <div className="bg-white border rounded-lg divide-y">
        {projects.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 ${
              selectedProjectId === p.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
            }`}
            onClick={() => setSelectedProjectId(p.id)}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {p.code}
                </span>
                <span className="font-medium text-gray-900">{p.name}</span>
              </div>
              {p.description && (
                <p className="text-sm text-gray-500 mt-1">{p.description}</p>
              )}
            </div>
            {selectedProjectId === p.id && (
              <span className="text-xs font-medium text-blue-600">Active</span>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No projects yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
