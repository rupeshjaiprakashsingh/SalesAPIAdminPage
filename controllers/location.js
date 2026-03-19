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
exports.logLocationBatch = async (req, res) => {
    try {
        const userId = req.user.id;
        // Support both { points: [...] } OR the raw array [...]
        let points = req.body.points || req.body;

        if (!points || !Array.isArray(points) || points.length === 0) {
            return res.status(400).json({ success: false, message: "Missing or invalid points array" });
        }

        const preparedLogs = points.map(pt => ({
            employeeId: userId,
            latitude: pt.latitude,
            longitude: pt.longitude,
            accuracy: pt.accuracy,
            speed: pt.speed,
            battery: pt.battery,
            timestamp: pt.timestamp ? new Date(pt.timestamp) : new Date()
        }));

        if (preparedLogs.length > 0) {
            await EmployeeLocationLog.insertMany(preparedLogs);
            
            // Latest point update
            const lastPoint = preparedLogs[preparedLogs.length - 1];
            await User.findByIdAndUpdate(userId, {
                lastLocation: { lat: lastPoint.latitude, lng: lastPoint.longitude, timestamp: lastPoint.timestamp },
                batteryStatus: lastPoint.battery,
                isOnline: true
            });
        }

        res.status(200).json({ 
            success: true, 
            message: `Batch processed: ${preparedLogs.length} saved`,
            saved: preparedLogs.length
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
