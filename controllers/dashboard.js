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

        // Total active non-admin users
        const totalUsers = await User.countDocuments({ role: { $ne: "admin" }, isActive: { $ne: false } });

        // --- Approved Present: users with an approved IN today ---
        const approvedIns = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "IN",
                    $or: [{ approvalStatus: "Approved" }, { status: "Present" }]
                }
            },
            { $group: { _id: "$userId" } },
            { $count: "count" }
        ]);
        const presentToday = approvedIns[0]?.count || 0;

        // --- All users who have ANY IN record today (Pending + Approved) ---
        const anyIns = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "IN"
                }
            },
            { $group: { _id: "$userId" } },
            { $count: "count" }
        ]);
        const totalPunchedInUsers = anyIns[0]?.count || 0;

        // --- Punched Out: users with an OUT record today (any status) ---
        const todayOuts = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "OUT"
                }
            },
            { $group: { _id: "$userId" } },
            { $count: "count" }
        ]);
        const punchedOut = todayOuts[0]?.count || 0;

        // --- Punched In (still at work): have IN but no OUT yet today ---
        const punchedIn = totalPunchedInUsers - punchedOut;

        // --- Pending Approvals: any record today awaiting review ---
        const pendingApprovals = await Attendance.countDocuments({
            deviceTime: { $gte: targetDate, $lt: nextDay },
            approvalStatus: "Pending"
        });

        // --- Half Day: approved OUT with working hours < 8 and >= 4 ---
        const halfDayResult = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "OUT",
                    $or: [{ approvalStatus: "Approved" }, { status: "Present" }],
                    workingHours: { $gte: 4, $lt: 8 }
                }
            },
            { $group: { _id: "$userId" } },
            { $count: "count" }
        ]);
        const halfDay = halfDayResult[0]?.count || 0;

        // --- Not Marked: active users with zero records at all today ---
        const notMarked = Math.max(totalUsers - totalPunchedInUsers, 0);

        // --- Absent: not marked minus those on leave (no leave model yet, so = notMarked) ---
        const onLeave = 0;
        const upcomingLeaves = 0;
        const absentToday = Math.max(notMarked - onLeave, 0);

        // --- Daily Work Entries: distinct users with any record today ---
        const dailyWorkEntries = totalPunchedInUsers;

        // --- Overtime: approved OUT with working hours > 9 ---
        const overtimeResult = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "OUT",
                    $or: [{ approvalStatus: "Approved" }, { status: "Present" }],
                    workingHours: { $gt: 9 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOvertimeMins: {
                        $sum: { $multiply: [{ $subtract: ["$workingHours", 9] }, 60] }
                    }
                }
            }
        ]);
        const totalOvertimeMins = Math.round(overtimeResult[0]?.totalOvertimeMins || 0);
        const overtimeHours = `${Math.floor(totalOvertimeMins / 60)}h ${totalOvertimeMins % 60}m`;

        // --- Fine Hours: approved OUT with working hours < 8 (shortage) ---
        const fineResult = await Attendance.aggregate([
            {
                $match: {
                    deviceTime: { $gte: targetDate, $lt: nextDay },
                    attendanceType: "OUT",
                    $or: [{ approvalStatus: "Approved" }, { status: "Present" }],
                    workingHours: { $lt: 8, $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalFineMins: {
                        $sum: { $multiply: [{ $subtract: [8, "$workingHours"] }, 60] }
                    }
                }
            }
        ]);
        const totalFineMins = Math.round(fineResult[0]?.totalFineMins || 0);
        const fineHours = `${Math.floor(totalFineMins / 60)}h ${totalFineMins % 60}m`;

        const deactivatedCount = await User.countDocuments({ role: { $ne: "admin" }, isActive: false });

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                present: presentToday,
                absent: absentToday,
                halfDay,
                punchedIn,
                punchedOut,
                notMarked,
                onLeave,
                upcomingLeaves,
                overtimeHours,
                fineHours,
                deactivated: deactivatedCount,
                dailyWorkEntries,
                pendingApprovals
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
                    attendanceType: "IN",
                    $or: [{ approvalStatus: "Approved" }, { status: "Present" }]
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
