import React from "react";
import { useLocation } from "react-router-dom";

const pageTitles = {
  "/": "Dashboard",
  "/tasks": "Task Management",
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "DeployFlow";

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
      {user && (
        <span className="text-sm text-gray-500">{user.email}</span>
      )}
    </header>
  );
}
