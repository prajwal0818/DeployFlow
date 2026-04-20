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
import { projectService } from "./services/projectService";

export const ProjectContext = createContext({
  projects: [],
  selectedProjectId: null,
  setSelectedProjectId: () => {},
  refreshProjects: () => {},
});

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return localStorage.getItem("selectedProjectId") || null;
  });

  const fetchProjects = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    projectService.getProjects()
      .then((res) => {
        setProjects(res.data);
        // Auto-select first project if none selected or selection is stale
        if (res.data.length > 0) {
          const ids = res.data.map((p) => p.id);
          setSelectedProjectId((prev) => {
            if (prev && ids.includes(prev)) return prev;
            return res.data[0].id;
          });
        }
      })
      .catch(() => {});
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
      setProjects(listRes.data);
      return created;
    }
    // Just refresh
    const listRes = await projectService.getProjects();
    setProjects(listRes.data);
  }, []);

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProjectId, setSelectedProjectId, refreshProjects }}
    >
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
  );
}

export default App;
