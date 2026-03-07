const LocationPing = require("../models/LocationPing");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

// @desc    Update user location
// @route   POST /api/v1/tracking/update
// @access  Private (User)
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, accuracy, speed, heading, batteryPercentage, deviceId, timestamp } = req.body;
        const userId = req.user.id; // From auth middleware

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
        }

        // 1. Create Location Ping
        const locationPing = await LocationPing.create({
            userId,
            latitude,
            longitude,
            accuracy: accuracy || 0,
            speed: speed || 0,
            heading: heading || 0,
            batteryPercentage: batteryPercentage || 0,
            deviceId: deviceId || null,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            isMock: req.body.isMock || false
        });

        // 2. Update User's last known location and status
        // Optimization: Update user document with latest location
        await User.findByIdAndUpdate(userId, {
            $set: {
                lastLocation: {
                    lat: latitude,
                    lng: longitude,
                    timestamp: timestamp ? new Date(timestamp) : new Date()
                },
                batteryStatus: batteryPercentage,
                isOnline: true // Assume user is online if sending updates
            }
        });

        res.status(200).json({
            success: true,
            message: "Location updated"
        });

    } catch (error) {
        console.error("Error updating location:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get live locations of all staff (Admin)
// @route   GET /api/v1/tracking/live
// @access  Private (Admin)
exports.getLiveLocations = async (req, res) => {
    try {
        // 1. Check Admin Role
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized to view live locations" });
        }

        const users = await User.find({ role: 'user' }).select('name lastLocation batteryStatus isOnline');

        // 3. Get latest attendance status for each user for TODAY
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const liveData = await Promise.all(users.map(async (user) => {
            // Find latest attendance for today (use deviceTime since that's what we manually seed/rely on)
            const lastAttendanceInfo = await Attendance.find({
                userId: user._id,
                deviceTime: { $gte: startOfDay }
            }).sort({ deviceTime: -1 }).limit(1);

            const lastAttendance = lastAttendanceInfo.length > 0 ? lastAttendanceInfo[0] : null;

            let status = "Not Marked";
            if (lastAttendance) {
                status = lastAttendance.attendanceType === 'IN' ? "Checked In" : "Checked Out";
            }

            return {
                userId: user._id,
                name: user.name,
                latitude: user.lastLocation?.lat || null,
                longitude: user.lastLocation?.lng || null,
                batteryPercentage: user.batteryStatus || null,
                lastUpdated: user.lastLocation?.timestamp || null,
                isOnline: user.isOnline || false,
                status: status
            };
        }));

        res.status(200).json({
            success: true,
            data: liveData
        });

    } catch (error) {
        console.error("Error fetching live locations:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get user route history (Timeline)
// @route   GET /api/v1/tracking/history/:userId
// @access  Private (Admin)
exports.getUserHistory = async (req, res) => {
    try {
        // 1. Check Admin Role
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized to view history" });
        }

        const { userId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required (YYYY-MM-DD)" });
        }

        const queryDate = new Date(date);
        const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

        // 2. Fetch Location Pings
        const pings = await LocationPing.find({
            userId: userId,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 });

        const path = pings.map(ping => ({
            lat: ping.latitude,
            lng: ping.longitude,
            ts: ping.timestamp.toLocaleTimeString() // Format as needed, e.g. HH:MM:SS
        }));

        res.status(200).json({
            success: true,
            userId,
            date,
            path
        });

    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
