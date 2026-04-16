import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import Login from "./components/auth/Login";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Dashboard from "./components/dashboard/Dashboard";
import TaskGrid from "./components/grid/TaskGrid";
import AcknowledgePage from "./components/acknowledge/AcknowledgePage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/acknowledge" element={<AcknowledgePage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<TaskGrid />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
