const express = require("express");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const connectDB = require("./DB_connection");
const { connectRedis } = require("./Redis_connection");
const urlRoutes = require("./routes/urlRoutes");
const { getUrlByShortCode } = require("./controllers/urlController");

const app = express();
const PORT = process.env.PORT || 3000;
const WORKER_ID = process.env.SERVER1_WORKER_ID;

if (!WORKER_ID) {
  throw new Error("Missing SERVER1_WORKER_ID in .env file.");
}

// CORS Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, "../frontend")));

// Server API Info & Health check
app.get("/api/info", (req, res) => {
  res.status(200).json({
    message: "Distributed URL Shortener API is running",
    workerId: WORKER_ID,
    port: PORT,
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    workerId: WORKER_ID,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount URL API routes: POST /api/urls/shorten, GET /api/urls/:shortCode
app.use("/api/urls", urlRoutes);

// Root level resolve route: GET /:shortCode
app.get("/:shortCode", getUrlByShortCode);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// Start Server
async function startServer() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Connect to Redis (optional cache layer)
    await connectRedis();

    // 3. Listen on configured port
    app.listen(PORT, () => {
      console.log(`Server (Worker ID: ${WORKER_ID}) is running on port ${PORT}.`);
      console.log(`Frontend UI available at: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
