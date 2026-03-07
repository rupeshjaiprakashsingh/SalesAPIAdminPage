const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
    createGeoFence,
    getAllGeoFences,
    checkGeofenceStatus,
    getGeofenceLogs
} = require("../controllers/geofence");

// Admin: Manage Fences
router.post("/create", auth, createGeoFence);
router.get("/list", auth, getAllGeoFences);

// Engine: Trigger check (can be called by mobile app periodically)
router.post("/check", auth, checkGeofenceStatus);

// Reports: Get logs
router.get("/logs/:userId", auth, getGeofenceLogs);

module.exports = router;
