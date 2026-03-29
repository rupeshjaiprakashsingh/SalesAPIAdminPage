// Models now come from req.models (tenant-specific)
const mongoose = require("mongoose");

// GET ADMIN DASHBOARD STATS
exports.getAdminStats = async (req, res) => {
    try {
        const dateParam = req.query.date;
        const targetDate = dateParam ? new Date(dateParam) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const { User, Attendance } = req.models;
        // Total active users count
        const totalUsers = await User.countDocuments({ role: { $ne: "admin" }, isActive: { $ne: false } }); // Count only active staff

        // Today's attendance - count unique users who marked IN
        const todayIns = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "IN"
                }
            },
            { $group: { _id: "$userId" } },
            { $count: "present" }
        ]);
        const presentToday = todayIns[0]?.present || 0;
        
        // Count unique users who marked OUT
        const todayOuts = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "OUT"
                }
            },
            { $group: { _id: "$userId" } },
            { $count: "punchedOut" }
        ]);
        const punchedOut = todayOuts[0]?.punchedOut || 0;

        const absentToday = totalUsers - presentToday > 0 ? totalUsers - presentToday : 0;

        // Mock additional fields that might be added to DB later
        const halfDay = 0;
        const onLeave = 0;
        const upcomingLeaves = 0;
        const overtimeHours = "0h 0m";
        const fineHours = "0h 0m";
        const deactivatedCount = await User.countDocuments({ role: { $ne: "admin" }, isActive: false });
        const deactivated = deactivatedCount;
        const dailyWorkEntries = presentToday + punchedOut; // Approximation for now

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                present: presentToday,
                absent: absentToday,
                halfDay,
                punchedIn: presentToday,
                punchedOut,
                notMarked: absentToday,
                onLeave,
                upcomingLeaves,
                overtimeHours,
                fineHours,
                deactivated,
                dailyWorkEntries
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
        const { Attendance } = req.models;
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

        const { Attendance } = req.models;
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

        const { Attendance } = req.models;
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
