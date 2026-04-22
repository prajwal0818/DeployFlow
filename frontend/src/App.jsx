import React, { useState, useEffect, useCallback, createContext } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import Login from "./components/auth/Login";
import SignUp from "./components/auth/SignUp";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LandingPage from "./components/landing/LandingPage";
import Dashboard from "./components/dashboard/Dashboard";
import TaskGrid from "./components/grid/TaskGrid";
import Profile from "./components/profile/Profile";
import Projects from "./components/projects/Projects";
import AcknowledgePage from "./components/acknowledge/AcknowledgePage";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import ToastContainer from "./components/ui/Toast";
import { projectService } from "./services/projectService";

export const ProjectContext = createContext({
  projects: [],
  selectedProjectId: null,
  setSelectedProjectId: () => {},
  refreshProjects: () => {},
  projectsLoading: false,
});

function App() {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return localStorage.getItem("selectedProjectId") || null;
  });

  const fetchProjects = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setProjectsLoading(false);
      return;
    }
    setProjectsLoading(true);
    projectService.getProjects()
      .then((res) => {
        // API returns { data: [...], total, page, limit } or plain array
        const list = Array.isArray(res.data) ? res.data : res.data.data || [];
        setProjects(list);
        // Auto-select first project if none selected or selection is stale
        if (list.length > 0) {
          const ids = list.map((p) => p.id);
          setSelectedProjectId((prev) => {
            if (prev && ids.includes(prev)) return prev;
            return list[0].id;
          });
        }
      })
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("selectedProjectId", selectedProjectId);
    } else {
      localStorage.removeItem("selectedProjectId");
    }
  }, [selectedProjectId]);

  // Called by Projects page when creating a new project.
  // Creates, refreshes the list, and returns the created project.
  const refreshProjects = useCallback(async (newProjectData) => {
    if (newProjectData) {
      const res = await projectService.createProject(newProjectData);
      const created = res.data;
      // Re-fetch full list to stay in sync
      const listRes = await projectService.getProjects();
      const list = Array.isArray(listRes.data) ? listRes.data : listRes.data.data || [];
      setProjects(list);
      return created;
    }
    // Refresh list and fix stale selection (e.g. after delete)
    const listRes = await projectService.getProjects();
    const list = Array.isArray(listRes.data) ? listRes.data : listRes.data.data || [];
    setProjects(list);
    if (list.length > 0) {
      const ids = list.map((p) => p.id);
      setSelectedProjectId((prev) => {
        if (prev && ids.includes(prev)) return prev;
        return list[0].id;
      });
    } else {
      setSelectedProjectId(null);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ProjectContext.Provider
        value={{ projects, selectedProjectId, setSelectedProjectId, refreshProjects, projectsLoading }}
      >
        <ToastContainer />
        <HashRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/acknowledge" element={<AcknowledgePage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tasks" element={<TaskGrid />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </ProjectContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
