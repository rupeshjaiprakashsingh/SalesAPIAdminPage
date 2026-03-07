const User = require("../models/User");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");

// GET ADMIN DASHBOARD STATS
exports.getAdminStats = async (req, res) => {
    try {
        // Total users count
        const totalUsers = await User.countDocuments();

        // Today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Today's attendance - count unique users who marked IN
        const todayAttendance = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: today, $lt: tomorrow },
                    attendanceType: "IN"
                }
            },
            {
                $group: {
                    _id: "$userId"
                }
            },
            {
                $count: "present"
            }
        ]);

        const presentToday = todayAttendance[0]?.present || 0;
        const absentToday = totalUsers - presentToday;

        // Average working hours (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const avgWorkingHours = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: thirtyDaysAgo },
                    attendanceType: "OUT",
                    workingHours: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: null,
                    avgHours: { $avg: "$workingHours" }
                }
            }
        ]);

        const averageHours = avgWorkingHours[0]?.avgHours || 0;

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                presentToday,
                absentToday,
                averageWorkingHours: parseFloat(averageHours.toFixed(2))
            }
        });
    } catch (error) {
        console.error("Admin stats error:", error);
        res.status(500).json({ message: error.message });
    }
};

// GET USER DASHBOARD STATS
exports.getUserStats = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;

        // Today's status
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayRecords = await Attendance.find({
            userId,
            deviceTime: { $gte: today, $lt: tomorrow }
        }).sort({ deviceTime: 1 });

        const hasCheckedIn = todayRecords.some(r => r.attendanceType === "IN");
        const hasCheckedOut = todayRecords.some(r => r.attendanceType === "OUT");
        const todayWorkingHours = todayRecords.find(r => r.attendanceType === "OUT")?.workingHours || 0;

        // This month's stats
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const monthAttendance = await Attendance.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    deviceTime: { $gte: firstDayOfMonth, $lt: firstDayOfNextMonth },
                    attendanceType: "IN"
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$deviceTime" }
                    }
                }
            },
            {
                $count: "daysPresent"
            }
        ]);

        const daysPresent = monthAttendance[0]?.daysPresent || 0;

        // Total working hours this month
        const monthWorkingHours = await Attendance.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    deviceTime: { $gte: firstDayOfMonth, $lt: firstDayOfNextMonth },
                    attendanceType: "OUT",
                    workingHours: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: null,
                    totalHours: { $sum: "$workingHours" }
                }
            }
        ]);

        const totalHours = monthWorkingHours[0]?.totalHours || 0;

        res.status(200).json({
            success: true,
            stats: {
                todayStatus: {
                    checkedIn: hasCheckedIn,
                    checkedOut: hasCheckedOut,
                    workingHours: todayWorkingHours
                },
                thisMonth: {
                    daysPresent,
                    totalWorkingHours: parseFloat(totalHours.toFixed(2)),
                    averageHoursPerDay: daysPresent > 0 ? parseFloat((totalHours / daysPresent).toFixed(2)) : 0
                }
            }
        });
    } catch (error) {
        console.error("User stats error:", error);
        res.status(500).json({ message: error.message });
    }
};

// GET ATTENDANCE TREND (Last N days)
exports.getAttendanceTrend = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const trend = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: startDate, $lte: endDate },
                    attendanceType: "IN"
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$deviceTime" } }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.date": 1 }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id.date",
                    count: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            trend
        });
    } catch (error) {
        console.error("Trend error:", error);
        res.status(500).json({ message: error.message });
    }
};

// GET RECENT ACTIVITY
exports.getRecentActivity = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const recentActivity = await Attendance.find()
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .limit(limit)
            .select("userId attendanceType deviceTime createdAt");

        res.status(200).json({
            success: true,
            activities: recentActivity
        });
    } catch (error) {
        console.error("Recent activity error:", error);
        res.status(500).json({ message: error.message });
    }
};
