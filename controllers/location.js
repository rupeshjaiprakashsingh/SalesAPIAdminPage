const EmployeeLocationLog = require("../models/EmployeeLocationLog");
const User = require("../models/User");

// Log new location (High frequency)
exports.logLocation = async (req, res) => {
    try {
        const { userId, latitude, longitude, accuracy, battery } = req.body;

        if (!userId || !latitude || !longitude) {
            return res.status(400).json({ message: "Missing coordinates or userId" });
        }

        const log = await EmployeeLocationLog.create({
            employeeId: userId,
            latitude,
            longitude,
            accuracy,
            battery,
            timestamp: new Date()
        });

        res.status(200).json({ success: true, message: "Location logged" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Live User Locations (Latest from Log)
exports.getLiveLocations = async (req, res) => {
    try {
        const pipeline = [
            // 1. Sort by latest
            { $sort: { timestamp: -1 } },

            // 2. Group by user to get latest
            {
                $group: {
                    _id: "$employeeId",
                    latestLog: { $first: "$$ROOT" }
                }
            },

            // 3. Join user info
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },

            // 4. Project
            {
                $project: {
                    userId: "$_id",
                    name: "$userDetails.name",
                    email: "$userDetails.email",
                    latitude: "$latestLog.latitude",
                    longitude: "$latestLog.longitude",
                    lastSeen: "$latestLog.timestamp",
                    battery: "$latestLog.battery",
                    status: "Active" // Differentiate from Attendance status
                }
            }
        ];

        const locations = await EmployeeLocationLog.aggregate(pipeline);

        res.status(200).json({ success: true, data: locations });

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
