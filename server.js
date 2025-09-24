// ==========================================
// server.js - COMPLETE UPDATE dengan Google Sheets Auto Sync
// ==========================================
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const imageProxyRoutes = require('./routes/imageProxy');
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
      "http://localhost:5000",
    ],
    credentials: true,
  })
);

app.use('/api/images', imageProxyRoutes);

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

// Serve static files (uploads) dengan CORS headers
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
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
    google_sheets: {
      configured: !!(process.env.GOOGLE_SHEETS_API_KEY && process.env.GOOGLE_SHEET_ID),
      sheet_id: process.env.GOOGLE_SHEET_ID,
      sync_interval_hours: process.env.SYNC_INTERVAL_HOURS || 6
    }
  });
});

// ==========================================
// ROUTES IMPORT
// ==========================================

// Existing routes
const authRoutes = require("./routes/authRoutes");
const bpnRoutes = require("./routes/bpnRoutes");
const marketPriceRoutes = require("./routes/marketPrices");
const regionRoutes = require("./routes/regionRoutes");
const overrideRoutes = require("./routes/overrideRoutes");
const marketPricePublicRoutes = require("./routes/marketPricesPublic");

// Sembako routes
const sembakoPriceRoutes = require("./routes/sembakoPrice");

// NEW: Google Sheets routes
const googleSheetRoutes = require("./routes/googleSheetSync");

// ==========================================
// ROUTES SETUP
// ==========================================

// Public routes untuk data terbuka (tidak perlu auth)
app.use("/public/market-prices", marketPricePublicRoutes);

// API routes dengan authentication
app.use("/api/auth", authRoutes);
app.use("/api/bpn", bpnRoutes);
app.use("/api/market-prices", marketPriceRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/overrides", overrideRoutes);

// Sembako API routes
app.use("/api/sembako", sembakoPriceRoutes);

// NEW: Google Sheets sync routes
app.use("/api/google-sheet", googleSheetRoutes);

// ==========================================
// ADDITIONAL API ENDPOINTS
// ==========================================

// API Info endpoint dengan Google Sheets info
app.get("/api/info", (req, res) => {
  res.json({
    success: true,
    message: "Pantau Pangan API with Google Sheets Integration",
    version: "2.1.0",
    endpoints: {
      auth: "/api/auth",
      bpn: "/api/bpn", 
      market_prices: "/api/market-prices",
      regions: "/api/regions",
      overrides: "/api/overrides",
      sembako: "/api/sembako",
      google_sheets: "/api/google-sheet", // NEW
      public: {
        market_prices: "/public/market-prices",
        sembako_stats: "/api/sembako/public/statistics",
        sembako_latest: "/api/sembako/public/latest"
      }
    },
    features: {
      market_prices: "Individual commodity prices",
      sembako: "9 basic food commodities tracking",
      csv_import: "Google Form/Sheet CSV import",
      google_sheets_sync: "Automatic Google Sheets synchronization", // NEW
      statistics: "Analytics and trends",
      export: "CSV data export"
    },
    google_sheets: {
      enabled: !!(process.env.GOOGLE_SHEETS_API_KEY && process.env.GOOGLE_SHEET_ID),
      sheet_id: process.env.GOOGLE_SHEET_ID || "Not configured",
      sync_interval_hours: parseInt(process.env.SYNC_INTERVAL_HOURS) || 6,
      range: process.env.GOOGLE_SHEET_RANGE || "Form Responses 1!A:N"
    }
  });
});

// Combined statistics endpoint (include Google Sheets data)
app.get("/api/combined/statistics", async (req, res) => {
  try {
    const MarketPrice = require("./models/MarketPrice");
    const SembakoPrice = require("./models/SembakoPrice");

    const [marketCount, sembakoCount, googleSheetCount] = await Promise.all([
      MarketPrice.count(),
      SembakoPrice.count(),
      SembakoPrice.count({ where: { source: 'google_sheet' } })
    ]);

    res.json({
      success: true,
      message: "Combined statistics with Google Sheets data",
      data: {
        market_prices: {
          total_records: marketCount,
          type: "individual_commodities"
        },
        sembako_prices: {
          total_records: sembakoCount,
          type: "9_basic_commodities",
          google_sheet_records: googleSheetCount,
          manual_records: sembakoCount - googleSheetCount
        },
        combined_total: marketCount + sembakoCount,
        data_sources: {
          google_sheets: googleSheetCount,
          manual_input: (sembakoCount - googleSheetCount),
          bpn_data: marketCount
        },
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Combined stats error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil combined statistics",
      error: error.message
    });
  }
});

// ==========================================
// FRONTEND & ERROR HANDLING
// ==========================================

// Serve frontend build (Vite)
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  // Skip API routes dari serving static files
  if (req.path.startsWith('/api/') || req.path.startsWith('/public/')) {
    return res.status(404).json({
      success: false,
      message: "API endpoint not found",
      requested_path: req.path
    });
  }
  
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// 404 handler untuk API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    requested_path: req.path,
    available_endpoints: [
      "/api/auth",
      "/api/bpn",
      "/api/market-prices", 
      "/api/regions",
      "/api/overrides",
      "/api/sembako",
      "/api/google-sheet", // NEW
      "/api/info"
    ]
  });
});

app.use('/public/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: "Public endpoint not found",
    requested_path: req.path,
    available_endpoints: [
      "/public/market-prices",
      "/api/sembako/public/statistics",
      "/api/sembako/public/latest"
    ]
  });
});

// General 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    requested_path: req.path
  });
});

// Global Error handler dengan Google Sheets error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  
  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: "File terlalu besar. Maksimal 10MB.",
      error: "FILE_TOO_LARGE"
    });
  }
  
  // Handle CSV file type errors
  if (err.message === 'Hanya file CSV yang diizinkan') {
    return res.status(400).json({
      success: false,
      message: "Format file tidak valid. Hanya file CSV yang diizinkan.",
      error: "INVALID_FILE_TYPE"
    });
  }

  // Handle Google Sheets API errors
  if (err.message.includes('Google Sheet')) {
    return res.status(503).json({
      success: false,
      message: "Google Sheets service error",
      error: process.env.NODE_ENV === 'development' ? err.message : 'External service error'
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.message : 'Server Error'
  });
});

// ==========================================
// GOOGLE SHEETS SCHEDULED SYNC STARTUP
// ==========================================

// Import scheduler after all routes are defined
const scheduledSync = require('./services/scheduledSync');

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📂 Uploads served at: http://localhost:${PORT}/uploads`);
  
  // Sembako endpoints logging
  console.log(`\n📊 SEMBAKO API ENDPOINTS:`);
  console.log(`   • Public Stats: http://localhost:${PORT}/api/sembako/public/statistics`);
  console.log(`   • Public Latest: http://localhost:${PORT}/api/sembako/public/latest`);
  console.log(`   • Private CRUD: http://localhost:${PORT}/api/sembako`);
  console.log(`   • Import CSV: http://localhost:${PORT}/api/sembako/import`);
  console.log(`   • Export CSV: http://localhost:${PORT}/api/sembako/export/csv`);
  console.log(`   • Trends: http://localhost:${PORT}/api/sembako/analysis/trends`);
  
  // NEW: Google Sheets endpoints logging
  console.log(`\n📋 GOOGLE SHEETS SYNC ENDPOINTS:`);
  console.log(`   • Manual Sync: http://localhost:${PORT}/api/google-sheet/sync`);
  console.log(`   • Sheet Info: http://localhost:${PORT}/api/google-sheet/info`);
  console.log(`   • Test Connection: http://localhost:${PORT}/api/google-sheet/test`);
  console.log(`   • Sync Status: http://localhost:${PORT}/api/google-sheet/status`);
  
  console.log(`\n🔗 OTHER ENDPOINTS:`);
  console.log(`   • API Info: http://localhost:${PORT}/api/info`);
  console.log(`   • Combined Stats: http://localhost:${PORT}/api/combined/statistics`);
  
  // Google Sheets configuration check
  const hasGoogleSheetsConfig = !!(process.env.GOOGLE_SHEETS_API_KEY && process.env.GOOGLE_SHEET_ID);
  
  console.log(`\n🔧 GOOGLE SHEETS CONFIGURATION:`);
  console.log(`   • API Key: ${process.env.GOOGLE_SHEETS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   • Sheet ID: ${process.env.GOOGLE_SHEET_ID ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   • Range: ${process.env.GOOGLE_SHEET_RANGE || 'Form Responses 1!A:N'}`);
  console.log(`   • Sync Interval: ${process.env.SYNC_INTERVAL_HOURS || 6} hours`);
  
  if (hasGoogleSheetsConfig) {
    // Start scheduled sync only if properly configured
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_SYNC === 'true') {
      try {
        scheduledSync.start();
        console.log(`\n📅 SCHEDULED SYNC: ✅ Enabled (every ${process.env.SYNC_INTERVAL_HOURS || 6} hours)`);
        console.log(`   • Next sync will start in 30 seconds for initial sync`);
        console.log(`   • Manual sync: POST http://localhost:${PORT}/api/google-sheet/sync`);
      } catch (error) {
        console.error(`❌ SCHEDULED SYNC: Failed to start - ${error.message}`);
      }
    } else {
      console.log(`\n📅 SCHEDULED SYNC: ⏸️ Disabled (development mode)`);
      console.log(`   • Set ENABLE_SCHEDULED_SYNC=true to enable in development`);
      console.log(`   • Manual sync available at: POST http://localhost:${PORT}/api/google-sheet/sync`);
    }
  } else {
    console.log(`\n📅 SCHEDULED SYNC: ❌ Disabled (Missing configuration)`);
    console.log(`   • Please set GOOGLE_SHEETS_API_KEY and GOOGLE_SHEET_ID in .env`);
  }
  
  console.log(`\n💡 QUICK TEST COMMANDS:`);
  console.log(`   curl http://localhost:${PORT}/api/sembako/public/statistics`);
  if (hasGoogleSheetsConfig) {
    console.log(`   curl http://localhost:${PORT}/api/google-sheet/status`);
  }
  
  console.log(`\n🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'Not configured'}`);
  console.log(`🚀 Server ready for requests!\n`);
});