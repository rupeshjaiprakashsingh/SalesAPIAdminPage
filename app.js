require("dotenv").config();
require("express-async-errors");

const connectDB = require("./db/connect");
const express = require("express");
const cors = require("cors");

const app = express();

// Routes
const userRoutes = require("./routes/user");
const attendanceRoutes = require("./routes/attendance");
const dashboardRoutes = require("./routes/dashboard");
const reportRoutes = require("./routes/reports");

// Tenant Middleware (Multi-tenant DB switching)
const tenantMiddleware = require("./middleware/tenant");

// Cron Jobs
const { scheduleDailyReport, scheduleKeepAlive } = require("./utils/cronJobs");

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

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

// Apply tenant middleware to ALL /api/v1 routes
app.use("/api/v1", tenantMiddleware);

// Versioned APIs
// Mount user routes at /api/v1 so endpoints become /api/v1/login, /api/v1/register
app.use("/api/v1", userRoutes);                 // Example: /api/v1/register
app.use("/api/v1/attendance", attendanceRoutes); // Example: /api/v1/attendance/mark
app.use("/api/v1/dashboard", dashboardRoutes);   // Example: /api/v1/dashboard/admin-stats
app.use("/api/v1/reports", reportRoutes);        // Example: /api/v1/reports/monthly-report
app.use("/api/v1/enquiry", require("./routes/enquiry")); // Public API for enquiry form
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
    });
  } catch (error) {
    console.log(error);
  }
};

start();
