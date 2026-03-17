const EmployeeLocationLog = require("../models/EmployeeLocationLog");
const User = require("../models/User");

// Log new location (High frequency)
// userId is taken from JWT token (req.user.id), NOT from request body — security fix
exports.logLocation = async (req, res) => {
    try {
        // Always use the authenticated user's ID from JWT
        const userId = req.user.id;
        const { latitude, longitude, accuracy, battery, batteryPercentage } = req.body;
        const finalBattery = battery !== undefined ? battery : batteryPercentage;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: "Missing coordinates" });
        }

        const now = new Date();

        // 1. Save the location ping to the log
        await EmployeeLocationLog.create({
            employeeId: userId,
            latitude,
            longitude,
            accuracy,
            battery: finalBattery,
            timestamp: now
        });

        // 2. Update the User's lastLocation, batteryStatus, and isOnline
        //    This keeps the User document as source-of-truth for live map
        await User.findByIdAndUpdate(userId, {
            lastLocation: {
                lat: latitude,
                lng: longitude,
                timestamp: now
            },
            batteryStatus: finalBattery,
            isOnline: true
        });

        res.status(200).json({ success: true, message: "Location logged" });
    } catch (error) {
        console.error("Location log error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Live User Locations (Latest ping per user from EmployeeLocationLog)
// Only staff with a ping in the last 30 minutes are considered "online"
exports.getLiveLocations = async (req, res) => {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const pipeline = [
            // 1. Only consider pings from last 30 minutes for freshness
            // (We still show all staff but mark online/offline based on recency)
            { $sort: { timestamp: -1 } },

            // 2. Group by user to get ONLY the latest ping per user
            {
                $group: {
                    _id: "$employeeId",
                    latestLog: { $first: "$$ROOT" }
                }
            },

            // 3. Join user info from User collection
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            // Skip users that no longer exist in User collection
            { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: false } },

            // 4. Project clean response
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
                    // isOnline: true if last ping was within 30 minutes
                    isOnline: {
                        $gte: ["$latestLog.timestamp", thirtyMinutesAgo]
                    },
                    accuracy: "$latestLog.accuracy"
                }
            },

            // 5. Sort: online staff first, then by lastSeen
            { $sort: { isOnline: -1, lastSeen: -1 } }
        ];

        const locations = await EmployeeLocationLog.aggregate(pipeline);

        res.status(200).json({
            success: true,
            count: locations.length,
            onlineCount: locations.filter(l => l.isOnline).length,
            data: locations
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Location History for a Specific User and Date (Where they reached)
exports.getUserHistory = async (req, res) => {
    try {
        const { userId, date } = req.query; // date should be 'YYYY-MM-DD'

        if (!userId || !date) {
            return res.status(400).json({ success: false, message: "Please provide userId and date (YYYY-MM-DD)" });
        }

        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const logs = await EmployeeLocationLog.find({
            employeeId: userId,
            timestamp: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        }).sort({ timestamp: 1 }); // Sort by time to show the path

        // Fetch User Details to include in response
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
