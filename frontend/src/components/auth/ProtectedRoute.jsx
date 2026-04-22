import React from "react";
import { Navigate, Outlet } from "react-router-dom";

function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Check expiry (exp is in seconds)
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem("token");
    return false;
  }
}

export default function ProtectedRoute() {
  const token = localStorage.getItem("token");

  if (!isTokenValid(token)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
