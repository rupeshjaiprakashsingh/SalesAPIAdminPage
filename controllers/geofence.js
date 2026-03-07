const GeoFence = require("../models/GeoFence");
const GeoFenceLog = require("../models/GeoFenceLog");
const { calculateDistance } = require("../utils/geoFence");

// Create a new GeoFence
exports.createGeoFence = async (req, res) => {
    try {
        const { title, lat, lng, radius } = req.body;

        const newFence = new GeoFence({
            title,
            center: { lat, lng },
            radius: radius || 200
        });

        await newFence.save();
        res.status(201).json({ success: true, data: newFence });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get All GeoFences
exports.getAllGeoFences = async (req, res) => {
    try {
        const fences = await GeoFence.find({ isActive: true });
        res.status(200).json({ success: true, data: fences });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// THE GEOFENCE ENGINE
// Checks user location against all fences and updates logs
exports.checkGeofenceStatus = async (req, res) => {
    try {
        const { userId, latitude, longitude } = req.body;

        if (!userId || !latitude || !longitude) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // 1. Get all active fences
        const fences = await GeoFence.find({ isActive: true });

        // 2. Determine which fences the user is currently INSIDE
        const insideFences = [];
        fences.forEach(fence => {
            const dist = calculateDistance(latitude, longitude, fence.center.lat, fence.center.lng);
            if (dist <= fence.radius) {
                insideFences.push(fence);
            }
        });

        // 3. Get currently OPEN sessions (INSIDE) for this user
        const openLogs = await GeoFenceLog.find({
            userId,
            status: "INSIDE"
        });

        const events = [];

        // 4. Handle ENTRIES (Inside fence but no open log)
        for (const fence of insideFences) {
            const existingLog = openLogs.find(log => log.fenceId.toString() === fence._id.toString());

            if (!existingLog) {
                // Create ENTRY log
                await GeoFenceLog.create({
                    fenceId: fence._id,
                    userId,
                    status: "INSIDE",
                    entryTime: new Date()
                });
                events.push(`Entered ${fence.title}`);
            }
        }

        // 5. Handle EXITS (Open log but no longer inside fence)
        for (const log of openLogs) {
            const stillInside = insideFences.find(fence => fence._id.toString() === log.fenceId.toString());

            if (!stillInside) {
                // Update EXIT log
                log.exitTime = new Date();
                log.status = "COMPLETED";
                await log.save();
                events.push(`Exited fence (ID: ${log.fenceId})`);
            }
        }

        res.status(200).json({
            success: true,
            insideFences: insideFences.map(f => f.title),
            events
        });

    } catch (error) {
        console.error("Geofence engine error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get Logs for a User
exports.getGeofenceLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const logs = await GeoFenceLog.find({ userId })
            .populate("fenceId", "title center")
            .sort({ entryTime: -1 });

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
