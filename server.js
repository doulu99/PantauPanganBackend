// server.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware security
app.use(helmet());

// CORS global (API & static files)
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5000", // biar frontend yg digabung tetap jalan
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
});
app.use(limiter);

// ✅ Serve static files (uploads) dengan CORS headers
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // bisa dibatasi ke frontend tertentu
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "public/uploads"))
);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes (API)
const authRoutes = require("./routes/authRoutes");
const bpnRoutes = require("./routes/bpnRoutes");
const marketPriceRoutes = require("./routes/marketPrices");
const regionRoutes = require("./routes/regionRoutes");
const overrideRoutes = require("./routes/overrideRoutes");
const marketPricePublicRoutes = require("./routes/marketPricesPublic");

app.use("/public/market-prices", marketPricePublicRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/bpn", bpnRoutes);
app.use("/api/market-prices", marketPriceRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/overrides", overrideRoutes);

// ✅ Serve frontend build (Vite) → letakkan sebelum handler 404
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📂 Uploads served at: http://localhost:${PORT}/uploads`);
});
