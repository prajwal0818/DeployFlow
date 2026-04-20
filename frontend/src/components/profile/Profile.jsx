import React from "react";

export default function Profile() {
  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  if (!user) {
    return (
      <div className="p-6 text-gray-500">No user information available.</div>
    );
  }

  const initials = (user.name || user.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const infoRows = [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email },
    { label: "Role", value: user.role || "USER" },
    { label: "User ID", value: user.id },
  ];

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-lg shadow divide-y">
        {infoRows.map((row) => (
          <div key={row.label} className="flex justify-between px-6 py-4">
            <span className="text-sm font-medium text-gray-500">{row.label}</span>
            <span className="text-sm text-gray-900">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Password</h3>
            <p className="text-sm text-gray-500 mt-1">Change your account password</p>
          </div>
          <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
