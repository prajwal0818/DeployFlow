import React, { useContext } from "react";
import { useLocation, Link } from "react-router-dom";
import { ProjectContext } from "../../App";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/tasks": "Task Management",
  "/projects": "Projects",
  "/profile": "Profile",
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "DeployFlow";
  const { projects, selectedProjectId, setSelectedProjectId } =
    useContext(ProjectContext);

  const user = React.useMemo(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { email: payload.email };
    } catch {
      return null;
    }
  }, []);

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-4">
        <select
          value={selectedProjectId || ""}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>Select Project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        {user && (
          <Link to="/profile" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {user.email}
          </Link>
        )}
      </div>
    </header>
  );
}
