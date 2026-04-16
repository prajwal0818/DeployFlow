import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";

const STATUS = { LOADING: "loading", SUCCESS: "success", ERROR: "error" };

export default function AcknowledgePage() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("task_id");
  const token = searchParams.get("token");

  const [status, setStatus] = useState(STATUS.LOADING);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId || !token) {
      setStatus(STATUS.ERROR);
      setError("Invalid acknowledgement link — missing task_id or token.");
      return;
    }

    let cancelled = false;

    api
      .get("/acknowledge", { params: { task_id: taskId, token } })
      .then((res) => {
        if (!cancelled) {
          setStatus(STATUS.SUCCESS);
          setData(res.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus(STATUS.ERROR);
          setError(
            err.response?.data?.error || err.message || "Something went wrong"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, token]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>DeployFlow</h1>

        {status === STATUS.LOADING && (
          <div style={styles.body}>
            <p style={styles.message}>Acknowledging task...</p>
          </div>
        )}

        {status === STATUS.SUCCESS && data && (
          <div style={styles.body}>
            <div style={styles.icon}>&#10003;</div>
            <h2 style={styles.heading}>{data.message}</h2>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={styles.label}>Task</td>
                  <td style={styles.value}>{data.taskName}</td>
                </tr>
                <tr>
                  <td style={styles.label}>Status</td>
                  <td style={styles.value}>
                    <span style={styles.badge}>{data.status}</span>
                  </td>
                </tr>
                {data.actualStartTime && (
                  <tr>
                    <td style={styles.label}>Started At</td>
                    <td style={styles.value}>
                      {new Date(data.actualStartTime).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {status === STATUS.ERROR && (
          <div style={styles.body}>
            <div style={{ ...styles.icon, backgroundColor: "#fee2e2", color: "#991b1b" }}>
              &#10007;
            </div>
            <h2 style={{ ...styles.heading, color: "#991b1b" }}>
              Acknowledgement Failed
            </h2>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f3f4f6",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    padding: "32px",
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#6b7280",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "24px",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  icon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "bold",
  },
  heading: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  message: {
    fontSize: "14px",
    color: "#6b7280",
  },
  table: {
    width: "100%",
    textAlign: "left",
    borderCollapse: "collapse",
    marginTop: "8px",
  },
  label: {
    padding: "8px 12px",
    fontSize: "13px",
    color: "#6b7280",
    fontWeight: 500,
    borderBottom: "1px solid #f3f4f6",
  },
  value: {
    padding: "8px 12px",
    fontSize: "13px",
    color: "#111827",
    borderBottom: "1px solid #f3f4f6",
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  errorText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
};
