const express = require("express");
const cors = require("cors");
const config = require("./config");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = [
  config.frontendUrl,
  "http://localhost:3000",
  "http://localhost:3004",
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Allow requests with no origin (server-to-server, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Health check for Docker / load balancer
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", routes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

module.exports = app;
