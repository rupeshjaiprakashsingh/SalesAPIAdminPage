const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
    getAdminStats,
    getUserStats,
    getAttendanceTrend,
    getRecentActivity
} = require("../controllers/dashboard");

// Admin dashboard stats (admin only)
router.get("/admin-stats", auth, getAdminStats);

// User dashboard stats
router.get("/user-stats/:userId?", auth, getUserStats);

// Attendance trend (last N days)
router.get("/attendance-trend", auth, getAttendanceTrend);

// Recent activity
router.get("/recent-activity", auth, getRecentActivity);

module.exports = router;
