const EmployeeLocationLog = require("../models/EmployeeLocationLog");
const User = require("../models/User");

// Helper to calculate distance in meters between two lat/lng coordinates
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371e3; // Radius of the earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
}

// Legacy Log single location (High frequency)
exports.logLocation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude, accuracy, battery, batteryPercentage } = req.body;
        const finalBattery = battery !== undefined ? battery : batteryPercentage;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: "Missing coordinates" });
        }

        const now = new Date();
        await EmployeeLocationLog.create({
            employeeId: userId,
            latitude,
            longitude,
            accuracy,
            battery: finalBattery,
            timestamp: now
        });

        await User.findByIdAndUpdate(userId, {
            lastLocation: { lat: latitude, lng: longitude, timestamp: now },
            batteryStatus: finalBattery,
            isOnline: true
        });

        res.status(200).json({ success: true, message: "Location logged" });
    } catch (error) {
        console.error("Location log error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Log Batch locations (Many points at once — Industry Standard)
// Applies server-side deduplication to prevent spider-web GPS jitter from being stored.
exports.logLocationBatch = async (req, res) => {
    try {
        const userId = req.user.id;
        // Support both { points: [...] } OR the raw array [...]
        let points = req.body.points || req.body;

        if (!points || !Array.isArray(points) || points.length === 0) {
            return res.status(400).json({ success: false, message: "Missing or invalid points array" });
        }

        // ─── SERVER-SIDE FILTERING (Industry Standard) ────────────────────
        // These thresholds match what Google Timeline, Uber, and Strava use.
        const ACCURACY_THRESHOLD = 50;         // meters — reject noisy GPS fixes
        const MIN_DISTANCE_M = 10;             // meters — skip jitter when stationary
        const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 min — force-save even if idle
        const MAX_SPEED_MPS = 55;              // ~200 km/h — reject teleportation glitches

        // Get the most recent stored point for this user to continue dedup across batches
        const lastStored = await EmployeeLocationLog.findOne({ employeeId: userId })
            .sort({ timestamp: -1 }).lean();

        let prevLat = lastStored ? lastStored.latitude : null;
        let prevLng = lastStored ? lastStored.longitude : null;
        let prevTime = lastStored ? new Date(lastStored.timestamp).getTime() : 0;

        const accepted = [];
        let skipped = 0;

        for (const pt of points) {
            const lat = Number(pt.latitude !== undefined ? pt.latitude : pt.lat);
            const lng = Number(pt.longitude !== undefined ? pt.longitude : pt.lng);
            const ts = pt.timestamp ? new Date(pt.timestamp).getTime() : Date.now();

            // 1. Basic validity
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) { skipped++; continue; }

            // 2. Accuracy filter — reject highly uncertain GPS fixes
            if (pt.accuracy && pt.accuracy > ACCURACY_THRESHOLD) { skipped++; continue; }

            // 3. Distance + heartbeat filter
            if (prevLat !== null && prevLng !== null) {
                const dist = getDistanceFromLatLonInM(prevLat, prevLng, lat, lng);
                const elapsed = ts - prevTime;

                // Skip if barely moved AND heartbeat hasn't elapsed
                if (dist < MIN_DISTANCE_M && elapsed < HEARTBEAT_INTERVAL_MS) { skipped++; continue; }

                // 4. Speed sanity check — reject teleportation from bad GPS
                if (elapsed > 0) {
                    const speedMps = (dist / elapsed) * 1000; // m/s
                    if (speedMps > MAX_SPEED_MPS) { skipped++; continue; }
                }
            }

            prevLat = lat;
            prevLng = lng;
            prevTime = ts;

            accepted.push({
                employeeId: userId,
                latitude: lat,
                longitude: lng,
                accuracy: pt.accuracy,
                speed: pt.speed,
                battery: pt.battery,
                timestamp: new Date(ts)
            });
        }

        if (accepted.length > 0) {
            await EmployeeLocationLog.insertMany(accepted);
            
            // Latest point update
            const lastPoint = accepted[accepted.length - 1];
            await User.findByIdAndUpdate(userId, {
                lastLocation: { lat: lastPoint.latitude, lng: lastPoint.longitude, timestamp: lastPoint.timestamp },
                batteryStatus: lastPoint.battery,
                isOnline: true
            });
        }

        res.status(200).json({ 
            success: true, 
            message: `Batch processed: ${accepted.length} saved, ${skipped} filtered`,
            saved: accepted.length,
            skipped: skipped
        });
    } catch (error) {
        console.error("Batch log error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Live User Locations (Latest ping per user)
exports.getLiveLocations = async (req, res) => {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const pipeline = [
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$employeeId", latestLog: { $first: "$$ROOT" } } },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userDetails" } },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    name: "$userDetails.name",
                    email: "$userDetails.email",
                    latitude: "$latestLog.latitude",
                    longitude: "$latestLog.longitude",
                    lastSeen: "$latestLog.timestamp",
                    battery: "$latestLog.battery",
                    isOnline: { $gte: ["$latestLog.timestamp", thirtyMinutesAgo] },
                    accuracy: "$latestLog.accuracy"
                }
            },
            { $sort: { isOnline: -1, lastSeen: -1 } }
        ];

        const locations = await EmployeeLocationLog.aggregate(pipeline);
        res.status(200).json({ success: true, count: locations.length, data: locations });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Location History for a Specific User and Date
exports.getUserHistory = async (req, res) => {
    try {
        const { userId, date } = req.query; // date: 'YYYY-MM-DD'
        if (!userId || !date) return res.status(400).json({ success: false, message: "Please provide userId and date" });

        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0,0,0,0);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23,59,59,999);

        const logs = await EmployeeLocationLog.find({
            employeeId: userId,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 });

        const user = await User.findById(userId).select("name email");
        res.status(200).json({
            success: true,
            user: user,
            count: logs.length,
            path: logs.map(log => ({
                lat: log.latitude,
                lng: log.longitude,
                timestamp: log.timestamp,
                accuracy: log.accuracy,
                battery: log.battery
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
