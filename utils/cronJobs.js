const cron = require("node-cron");

const generateAndSendDailyReport = async (targetDate = new Date()) => {
    try {
        console.log(`Running daily report generation for ${targetDate}...`);

        const { sendEmail, createDailyReportHTML } = require("../utils/emailService");
        const User = require("../models/User");
        const Attendance = require("../models/Attendance");

        // Generate report data
        const today = new Date(targetDate);
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all users
        const allUsers = await User.find().select("name email");
        const totalUsers = allUsers.length;

        // Get today's attendance
        const todayAttendance = await Attendance.find({
            deviceTime: { $gte: startOfDay, $lte: endOfDay }
        }).populate("userId", "name email");

        // Group by user
        const userAttendanceMap = {};
        todayAttendance.forEach(record => {
            const userId = record.userId?._id?.toString();
            if (!userId) return;

            if (!userAttendanceMap[userId]) {
                userAttendanceMap[userId] = {
                    name: record.userId.name,
                    email: record.userId.email,
                    checkIn: null,
                    checkOut: null,
                    workingHours: 0,
                    status: "Absent"
                };
            }

            if (record.attendanceType === "IN") {
                userAttendanceMap[userId].checkIn = new Date(record.deviceTime).toLocaleTimeString();
                userAttendanceMap[userId].status = "Present";
            } else if (record.attendanceType === "OUT") {
                userAttendanceMap[userId].checkOut = new Date(record.deviceTime).toLocaleTimeString();
                userAttendanceMap[userId].workingHours = record.workingHours || 0;
            }
        });

        // Create attendance list with all users
        const attendanceList = allUsers.map(user => {
            const userId = user._id.toString();
            return userAttendanceMap[userId] || {
                name: user.name,
                email: user.email,
                checkIn: null,
                checkOut: null,
                workingHours: 0,
                status: "Absent"
            };
        });

        const presentCount = attendanceList.filter(u => u.status === "Present").length;
        const absentCount = totalUsers - presentCount;

        const reportData = {
            date: today,
            totalUsers,
            presentCount,
            absentCount,
            attendanceList
        };

        // Get admin emails
        const admins = await User.find({ role: "admin" }).select("email");
        const adminEmails = admins.map(admin => admin.email).join(",");

        if (adminEmails) {
            const html = createDailyReportHTML(reportData);
            console.log("Generated report HTML, sending email...");
            const result = await sendEmail(
                adminEmails,
                `Daily Attendance Report - ${new Date().toLocaleDateString()}`,
                html
            );

            if (result.success) {
                console.log("Daily report sent successfully:", result.messageId);
                return { success: true, messageId: result.messageId };
            } else {
                console.error("Failed to send daily report:", result.error);
                return { success: false, error: result.error };
            }
        } else {
            console.log("No admin emails found for daily report");
            return { success: false, message: "No admin emails found" };
        }
    } catch (error) {
        console.error("Daily report cron error:", error);
        return { success: false, error: error.message };
    }
};

// Schedule daily report at 6 PM every day
const scheduleDailyReport = () => {
    // Cron format: minute hour day month weekday
    // "0 18 * * *" = Every day at 6:00 PM
    cron.schedule("0 18 * * *", async () => {
        await generateAndSendDailyReport();
    });

    console.log("Daily report cron job scheduled for 6:00 PM every day");
};

// Export the function to be called from app.js
module.exports = { scheduleDailyReport, generateAndSendDailyReport };
