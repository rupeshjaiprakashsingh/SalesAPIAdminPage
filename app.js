require("dotenv").config();
require("express-async-errors");

const connectDB = require("./db/connect");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();

// Routes
const userRoutes = require("./routes/user");
const attendanceRoutes = require("./routes/attendance");
const dashboardRoutes = require("./routes/dashboard");
const reportRoutes = require("./routes/reports");

// Tenant Middleware (Multi-tenant DB switching)
const tenantMiddleware = require("./middleware/tenant");

// Cron Jobs
const { scheduleDailyReport, scheduleKeepAlive, schedulePhotoCleanup, deleteOldPhotos, cleanupLocationLogs } = require("./utils/cronJobs");

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS — lock down to known origins in production
const envOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...envOrigins, "https://ss.scanservices.in", "http://localhost:5173", "http://localhost:3000"])];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true
}));

// Rate limiter for auth endpoints — 10 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many login attempts. Please try again after 15 minutes." }
});

// Serve uploads
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Keep-alive / health check (for external ping every ~14 min to prevent Render sleep)
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});
app.get("/ping", (req, res) => {
  res.status(200).send("ok");
});

// Internal Cron entry points — secured with a server-only secret key
const cronAuth = (req, res, next) => {
  const key = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return res.status(403).json({ msg: "Forbidden" });
  }
  next();
};

app.get("/api/v1/cleanup-photos", cronAuth, async (req, res) => {
  const result = await deleteOldPhotos();
  res.status(result.success ? 200 : 500).json(result);
});

app.get("/api/v1/cleanup-location-logs", cronAuth, async (req, res) => {
  const result = await cleanupLocationLogs();
  res.status(result.success ? 200 : 500).json(result);
});

// Unified endpoint for external cron schedulers (like cron-job.org)
app.get("/api/v1/run-daily-cleanup", cronAuth, async (req, res) => {
  const photoResult = await deleteOldPhotos();
  const locationResult = await cleanupLocationLogs();
  
  const isSuccess = photoResult.success && locationResult.success;
  res.status(isSuccess ? 200 : 500).json({
    success: isSuccess,
    photos_cleanup: photoResult,
    location_cleanup: locationResult
  });
});

// Apply rate limiter BEFORE tenant middleware — blocks brute-force before any DB call
app.use("/api/v1/login", authLimiter);
app.use("/api/v1/register", authLimiter);

// Apply tenant middleware to ALL /api/v1 routes
app.use("/api/v1", tenantMiddleware);

// Versioned APIs
app.use("/api/v1", userRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/enquiry", require("./routes/enquiry"));
app.use("/api/v1/geofence", require("./routes/geofence"));
app.use("/api/v1/location", require("./routes/location"));
app.use("/api/v1/tracking", require("./routes/trackingRoutes"));
app.use("/api/v1/customers", require("./routes/customers"));
app.use("/api/v1/settings", require("./routes/settings"));

const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}`);

      // Start cron jobs
      scheduleDailyReport();
      scheduleKeepAlive();
      schedulePhotoCleanup();
    });
  } catch (error) {
    console.error("[FATAL] Server failed to start:", error);
    process.exit(1);
  }
};

// Global error handler — must be last middleware
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(status).json({
    msg: err.message || "Internal Server Error",
    ...(isDev && { stack: err.stack })
  });
});

start();
