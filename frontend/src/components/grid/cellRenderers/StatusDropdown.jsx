import React from "react";
import { STATUS_BADGE_COLORS } from "../../../utils/constants";

const STATUS_COLORS = STATUS_BADGE_COLORS;

export default function StatusRenderer(params) {
  const value = params.value;
  if (!value) return null;

  const colors = STATUS_COLORS[value] || { bg: "#f3f4f6", text: "#374151" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.text,
        lineHeight: "20px",
      }}
    >
      {value}
    </span>
  );
}
