const cron = require("node-cron");
const https = require("https");

const tenants = require("../config/tenants");
const getTenantModels = require("../models/tenantModels");

const generateAndSendDailyReport = async (targetDate = new Date()) => {
    try {
        console.log(`Running daily report generation for ${targetDate}...`);

        const { sendEmail, createDailyReportHTML } = require("../utils/emailService");

        for (const [tenantId, tenant] of Object.entries(tenants)) {
            console.log(`Generating report for tenant: ${tenant.name}`);
            const { models } = getTenantModels(tenantId);
            const { User, Attendance } = models;

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
                tenantName: tenant.name,
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
                console.log(`Generated report HTML for ${tenant.name}, sending email...`);
                const result = await sendEmail(
                    adminEmails,
                    `Daily Attendance Report - ${tenant.name} - ${new Date().toLocaleDateString()}`,
                    html
                );

                if (result.success) {
                    console.log(`Daily report sent successfully for ${tenant.name}:`, result.messageId);
                } else {
                    console.error(`Failed to send daily report for ${tenant.name}:`, result.error);
                }
            } else {
                console.log(`No admin emails found for daily report in tenant: ${tenant.name}`);
            }
        }
        return { success: true };
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

const scheduleKeepAlive = () => {
    // Ping every 10 minutes to prevent Render free tier from sleeping
    cron.schedule("*/10 * * * *", () => {
        // Use RENDER_EXTERNAL_URL if available, otherwise fallback to known URL
        const url = process.env.RENDER_EXTERNAL_URL || "https://salesapiadminpage.onrender.com/api/v1/health";
        console.log(`[Keep-Alive] Pinging ${url}...`);
        
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log("[Keep-Alive] Ping successful");
            } else {
                console.log(`[Keep-Alive] Ping failed with status: ${res.statusCode}`);
            }
        }).on('error', (err) => {
            console.error("[Keep-Alive] Ping error:", err.message);
        });
    });
    console.log("Keep-alive cron job scheduled for every 10 minutes");
};

const deleteOldPhotos = async () => {
    try {
        console.log("Running auto-cleanup of old attendance photos (older than 90 days)...");
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        let cleanupReport = [];

        for (const [tenantId, tenant] of Object.entries(tenants)) {
            const { models } = getTenantModels(tenantId);
            const { Attendance } = models;

            // Unset photoUrl (Base64 string) to free up MongoDB space
            const result = await Attendance.updateMany(
                {
                    deviceTime: { $lt: ninetyDaysAgo },
                    photoUrl: { $exists: true, $ne: null, $ne: "" }
                },
                {
                    $unset: { photoUrl: 1 }
                }
            );
            console.log(`[${tenant.name}] Cleaned up ${result.modifiedCount} old attendance photos.`);
            cleanupReport.push({ tenant: tenant.name, cleaned: result.modifiedCount });
        }
        return { success: true, message: "Photo cleanup executed.", report: cleanupReport };
    } catch (e) {
        console.error("Auto-cleanup photo cron error:", e);
        return { success: false, error: e.message };
    }
};

const schedulePhotoCleanup = () => {
    // Run once a day at 2:00 AM
    cron.schedule("0 2 * * *", async () => {
        await deleteOldPhotos();
    });
    console.log("Photo auto-cleanup cron job scheduled for 2:00 AM every day");
};

// Export the function to be called from app.js
module.exports = { scheduleDailyReport, generateAndSendDailyReport, scheduleKeepAlive, schedulePhotoCleanup, deleteOldPhotos };
