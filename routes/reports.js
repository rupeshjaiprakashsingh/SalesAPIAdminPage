const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
    sendDailyReport,
    getMonthlyReport,
    exportMonthlyExcel,
    getDateRangeReport,
    exportDateRangeExcel,
    getTimelineReport,
    getCalendarReport,
    getDashboardStats
} = require("../controllers/reports");

// Send daily report email (admin only)
router.post("/daily-report", auth, sendDailyReport);

// Get monthly report data
router.get("/monthly-report", auth, getMonthlyReport);

// Export monthly report to Excel
router.get("/export-excel", auth, exportMonthlyExcel);

// Get date range report data
router.get("/date-range-report", auth, getDateRangeReport);

// Export date range report to Excel
router.get("/export-date-range-excel", auth, exportDateRangeExcel);

// Get timeline report (route & stats)
router.get("/timeline-report", auth, getTimelineReport);

// Get calendar report data
router.get("/calendar-report", auth, getCalendarReport);

// Get dashboard stats (all users total distances/times)
router.get("/dashboard-stats", auth, getDashboardStats);

module.exports = router;
