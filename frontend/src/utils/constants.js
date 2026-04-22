export const TASK_STATUSES = [
  "Pending",
  "Triggered",
  "Acknowledged",
  "Completed",
  "Blocked",
];

export const SYSTEMS = [
  "FOL",
  "SAP GW",
  "Fiserv",
];

// Status → Tailwind classes (used in Dashboard cards and tables)
export const STATUS_CARD_COLORS = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Triggered: "bg-blue-100 text-blue-800 border-blue-300",
  Acknowledged: "bg-purple-100 text-purple-800 border-purple-300",
  Completed: "bg-green-100 text-green-800 border-green-300",
  Blocked: "bg-red-100 text-red-800 border-red-300",
};

// Status → hex colors (used in AG Grid cell renderers)
export const STATUS_BADGE_COLORS = {
  Pending: { bg: "#f3f4f6", text: "#374151" },
  Triggered: { bg: "#dbeafe", text: "#1d4ed8" },
  Acknowledged: { bg: "#fef3c7", text: "#92400e" },
  Completed: { bg: "#d1fae5", text: "#065f46" },
  Blocked: { bg: "#fee2e2", text: "#991b1b" },
};
