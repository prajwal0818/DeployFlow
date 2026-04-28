import React, { useContext } from "react";
import { useLocation, Link } from "react-router-dom";
import { ProjectContext } from "../../App";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/tasks": "Task Management",
  "/projects": "Projects",
  "/profile": "Profile",
};

function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function Header({ onToggleMobile }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "DeployFlow";
  const { projects, selectedProjectId, setSelectedProjectId, projectsLoading } =
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
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobile}
          className="md:hidden p-1.5 rounded hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <MenuIcon />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <select
          value={selectedProjectId || ""}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          disabled={projectsLoading}
          aria-label="Select project"
          className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {projectsLoading ? (
            <option value="" disabled>Loading projects...</option>
          ) : (
            <>
              <option value="" disabled>Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </>
          )}
        </select>
        {user && (
          <Link to="/profile" className="hidden sm:block text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {user.email}
          </Link>
        )}
      </div>
    </header>
  );
}
