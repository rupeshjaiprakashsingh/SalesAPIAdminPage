// Models now come from req.models (tenant-specific)
const { sendEmail, createDailyReportHTML } = require("../utils/emailService");
const ExcelJS = require("exceljs");

// Generate Daily Report Data
const generateDailyReportData = async (date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
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

    return {
        date,
        totalUsers,
        presentCount,
        absentCount,
        attendanceList
    };
};

// Send Daily Report Email
exports.sendDailyReport = async (req, res) => {
    try {
        const date = req.query.date || new Date();

        // Use the shared logic from cronJobs
        const { generateAndSendDailyReport } = require("../utils/cronJobs");
        const result = await generateAndSendDailyReport(date);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: "Daily report sent successfully",
                messageId: result.messageId,
                previewUrl: result.previewUrl
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message || "Failed to send email",
                error: result.error
            });
        }
    } catch (error) {
        console.error("Daily report controller error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while sending report",
            error: error.message
        });
    }
};

// Get Monthly Report Data
exports.getMonthlyReport = async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({ message: "Year and month are required" });
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const { User, Attendance } = req.models;
        // Get all users
        const allUsers = await User.find().select("name email");

        // Get attendance for the month
        const monthAttendance = await Attendance.find({
            deviceTime: { $gte: startDate, $lte: endDate }
        }).populate("userId", "name email");

        // Group by user and date
        const userReportMap = {};

        allUsers.forEach(user => {
            userReportMap[user._id.toString()] = {
                _id: user._id,
                name: user.name,
                email: user.email,
                daysPresent: 0,
                daysAbsent: 0,
                totalWorkingHours: 0,
                averageWorkingHours: 0,
                dailyRecords: {}
            };
        });

        monthAttendance.forEach(record => {
            const userId = record.userId?._id?.toString();
            if (!userId || !userReportMap[userId]) return;

            const dateStr = new Date(record.deviceTime).toISOString().split('T')[0];

            if (!userReportMap[userId].dailyRecords[dateStr]) {
                userReportMap[userId].dailyRecords[dateStr] = {
                    checkIn: null,
                    checkOut: null,
                    workingHours: 0
                };
            }

            if (record.attendanceType === "IN") {
                userReportMap[userId].dailyRecords[dateStr].checkIn = record.deviceTime;
            } else if (record.attendanceType === "OUT") {
                userReportMap[userId].dailyRecords[dateStr].checkOut = record.deviceTime;
                userReportMap[userId].dailyRecords[dateStr].workingHours = record.workingHours || 0;
            }
        });

        // Calculate summary stats
        Object.keys(userReportMap).forEach(userId => {
            const user = userReportMap[userId];
            const daysInMonth = new Date(year, month, 0).getDate();

            user.daysPresent = Object.keys(user.dailyRecords).length;
            user.daysAbsent = daysInMonth - user.daysPresent;

            user.totalWorkingHours = Object.values(user.dailyRecords)
                .reduce((sum, day) => sum + (day.workingHours || 0), 0);

            user.averageWorkingHours = user.daysPresent > 0
                ? user.totalWorkingHours / user.daysPresent
                : 0;
        });

        const reportData = Object.values(userReportMap);

        res.status(200).json({
            success: true,
            year: parseInt(year),
            month: parseInt(month),
            monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
            data: reportData
        });
    } catch (error) {
        console.error("Monthly report error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Export Monthly Report to Excel
exports.exportMonthlyExcel = async (req, res) => {
    try {
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({ message: "Year and month are required" });
        }

        // Get report data (reuse the logic)
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const { User, Attendance } = req.models;
        const allUsers = await User.find().select("name email");
        const monthAttendance = await Attendance.find({
            deviceTime: { $gte: startDate, $lte: endDate }
        }).populate("userId", "name email");

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Monthly Attendance');

        // Add title
        worksheet.mergeCells('A1:F1');
        worksheet.getCell('A1').value = `Monthly Attendance Report - ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Add headers
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Name', 'Email', 'Days Present', 'Days Absent', 'Total Hours', 'Avg Hours/Day']);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
        };
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Process data
        const userReportMap = {};
        allUsers.forEach(user => {
            userReportMap[user._id.toString()] = {
                name: user.name,
                email: user.email,
                daysPresent: 0,
                totalWorkingHours: 0,
                dailyRecords: {}
            };
        });

        monthAttendance.forEach(record => {
            const userId = record.userId?._id?.toString();
            if (!userId || !userReportMap[userId]) return;

            const dateStr = new Date(record.deviceTime).toISOString().split('T')[0];

            if (!userReportMap[userId].dailyRecords[dateStr]) {
                userReportMap[userId].dailyRecords[dateStr] = { workingHours: 0 };
            }

            if (record.attendanceType === "OUT") {
                userReportMap[userId].dailyRecords[dateStr].workingHours = record.workingHours || 0;
            }
        });

        const daysInMonth = new Date(year, month, 0).getDate();

        Object.values(userReportMap).forEach(user => {
            user.daysPresent = Object.keys(user.dailyRecords).length;
            user.daysAbsent = daysInMonth - user.daysPresent;
            user.totalWorkingHours = Object.values(user.dailyRecords)
                .reduce((sum, day) => sum + (day.workingHours || 0), 0);
            user.averageWorkingHours = user.daysPresent > 0
                ? user.totalWorkingHours / user.daysPresent
                : 0;

            worksheet.addRow([
                user.name,
                user.email,
                user.daysPresent,
                user.daysAbsent,
                parseFloat(user.totalWorkingHours.toFixed(2)),
                parseFloat(user.averageWorkingHours.toFixed(2))
            ]);
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = 20;
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_${year}_${month}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Excel export error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get Date Range Report Data
exports.getDateRangeReport = async (req, res) => {
    try {
        const { fromDate, toDate, userId } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ message: "From date and to date are required" });
        }

        // Parse dates properly to avoid timezone issues
        const [startYear, startMonth, startDay] = fromDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = toDate.split('-').map(Number);

        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

        if (startDate > endDate) {
            return res.status(400).json({ message: "From date cannot be after to date" });
        }

        // User Filter
        const userQuery = {};
        if (userId && userId !== "all") {
            userQuery._id = userId;
        }

        const { User, Attendance } = req.models;
        // Get users
        const allUsers = await User.find(userQuery).select("name email");

        // Attendance Filter
        const attendanceQuery = {
            deviceTime: { $gte: startDate, $lte: endDate }
        };
        if (userId && userId !== "all") {
            attendanceQuery.userId = userId;
        }

        const rangeAttendance = await Attendance.find(attendanceQuery).populate("userId", "name email");

        // Group by user and date
        const userReportMap = {};

        allUsers.forEach(user => {
            userReportMap[user._id.toString()] = {
                name: user.name,
                email: user.email,
                daysPresent: 0,
                daysAbsent: 0,
                totalWorkingHours: 0,
                averageWorkingHours: 0,
                dailyRecords: {}
            };
        });

        rangeAttendance.forEach(record => {
            const rUserId = record.userId?._id?.toString();
            // Only process if this user is in our map (which handles the filtering effectively)
            if (!rUserId || !userReportMap[rUserId]) return;

            const dateStr = new Date(record.deviceTime).toISOString().split('T')[0];

            if (!userReportMap[rUserId].dailyRecords[dateStr]) {
                userReportMap[rUserId].dailyRecords[dateStr] = {
                    checkIn: null,
                    checkOut: null,
                    workingHours: 0
                };
            }

            if (record.attendanceType === "IN") {
                userReportMap[rUserId].dailyRecords[dateStr].checkIn = record.deviceTime;
            } else if (record.attendanceType === "OUT") {
                userReportMap[rUserId].dailyRecords[dateStr].checkOut = record.deviceTime;
                userReportMap[rUserId].dailyRecords[dateStr].workingHours = record.workingHours || 0;
            }
        });

        // Calculate summary stats
        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        Object.keys(userReportMap).forEach(key => {
            const user = userReportMap[key];

            user.daysPresent = Object.keys(user.dailyRecords).length;
            user.daysAbsent = totalDays - user.daysPresent;

            user.totalWorkingHours = Object.values(user.dailyRecords)
                .reduce((sum, day) => sum + (day.workingHours || 0), 0);

            user.averageWorkingHours = user.daysPresent > 0
                ? user.totalWorkingHours / user.daysPresent
                : 0;
        });

        const reportData = Object.values(userReportMap);

        res.status(200).json({
            success: true,
            fromDate,
            toDate,
            totalDays,
            data: reportData
        });
    } catch (error) {
        console.error("Date range report error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Export Date Range Report to Excel with Date Column
exports.exportDateRangeExcel = async (req, res) => {
    try {
        const { fromDate, toDate, userId } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ message: "From date and to date are required" });
        }

        // Parse dates properly to avoid timezone issues
        const [startYear, startMonth, startDay] = fromDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = toDate.split('-').map(Number);

        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

        if (startDate > endDate) {
            return res.status(400).json({ message: "From date cannot be after to date" });
        }

        // User Filter
        const userQuery = {};
        if (userId && userId !== "all") {
            userQuery._id = userId;
        }

        const { User, Attendance } = req.models;
        const allUsers = await User.find(userQuery).select("name email");

        // Attendance Filter
        const attendanceQuery = {
            deviceTime: { $gte: startDate, $lte: endDate }
        };
        if (userId && userId !== "all") {
            attendanceQuery.userId = userId;
        }

        const rangeAttendance = await Attendance.find(attendanceQuery).populate("userId", "name email");

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Date Range Attendance');

        // Add title
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = `Attendance Report - ${new Date(fromDate).toLocaleDateString('en-US')} to ${new Date(toDate).toLocaleDateString('en-US')}`;
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Add headers with Date column
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['Name', 'Email', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Status']);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
        };
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Process data - create date-wise records
        const userReportMap = {};
        allUsers.forEach(user => {
            userReportMap[user._id.toString()] = {
                name: user.name,
                email: user.email,
                dailyRecords: {}
            };
        });

        rangeAttendance.forEach(record => {
            const rUserId = record.userId?._id?.toString();
            if (!rUserId || !userReportMap[rUserId]) return;

            const dateStr = new Date(record.deviceTime).toISOString().split('T')[0];

            if (!userReportMap[rUserId].dailyRecords[dateStr]) {
                userReportMap[rUserId].dailyRecords[dateStr] = {
                    checkIn: null,
                    checkOut: null,
                    workingHours: 0
                };
            }

            if (record.attendanceType === "IN") {
                userReportMap[rUserId].dailyRecords[dateStr].checkIn = record.deviceTime;
            } else if (record.attendanceType === "OUT") {
                userReportMap[rUserId].dailyRecords[dateStr].checkOut = record.deviceTime;
                userReportMap[rUserId].dailyRecords[dateStr].workingHours = record.workingHours || 0;
            }
        });

        // Generate all dates in range (using local dates to avoid timezone issues)
        const dateArray = [];
        const loopDate = new Date(startDate);
        while (loopDate <= endDate) {
            const year = loopDate.getFullYear();
            const month = String(loopDate.getMonth() + 1).padStart(2, '0');
            const day = String(loopDate.getDate()).padStart(2, '0');
            dateArray.push(`${year}-${month}-${day}`);
            loopDate.setDate(loopDate.getDate() + 1);
        }

        // Add rows for each user and each date
        Object.values(userReportMap).forEach(user => {
            dateArray.forEach(dateStr => {
                const dayRecord = user.dailyRecords[dateStr];

                // Format date properly without timezone issues
                const [year, month, day] = dateStr.split('-').map(Number);
                const dateObj = new Date(year, month - 1, day);
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                if (dayRecord) {
                    // User was present on this date
                    const checkInTime = dayRecord.checkIn
                        ? new Date(dayRecord.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                        : '-';
                    const checkOutTime = dayRecord.checkOut
                        ? new Date(dayRecord.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                        : '-';
                    const workingHours = dayRecord.workingHours > 0
                        ? parseFloat(dayRecord.workingHours.toFixed(2))
                        : 0;

                    worksheet.addRow([
                        user.name,
                        user.email,
                        formattedDate,
                        checkInTime,
                        checkOutTime,
                        workingHours,
                        'Present'
                    ]);
                } else {
                    // Only show absent rows if specific user selected OR if explicitly desired. 
                    // For now keeping it essentially same as before to show full attendance log.
                    worksheet.addRow([
                        user.name,
                        user.email,
                        formattedDate,
                        '-',
                        '-',
                        0,
                        'Absent'
                    ]);
                }
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = 18;
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_${fromDate}_to_${toDate}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Date range Excel export error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get Timeline Report (Route & Stats)
exports.getTimelineReport = async (req, res) => {
    try {
        const { userId, date } = req.query;
        if (!userId || !date) {
            return res.status(400).json({ message: "UserId and Date are required" });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch logs (using EmployeeLocationLog for precise map routing)
        const EmployeeLocationLog = req.models.EmployeeLocationLog;
        const logs = await EmployeeLocationLog.find({
            employeeId: userId,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 }).lean();

        if (!logs || logs.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    employeeId: userId,
                    date,
                    totalDistance: 0,
                    idleTime: 0,
                    motionTime: 0,
                    stopDetails: [],
                    route: []
                }
            });
        }

        // Calculation Logic
        const { calculateDistance } = require("../utils/geoFence");

        let totalDistance = 0; // meters
        let idleTime = 0; // minutes
        let motionTime = 0; // minutes
        let stopDetails = [];
        let previousLog = logs[0];

        // Thresholds
        const DISTANCE_THRESHOLD = 20; // meters (to consider motion)
        const TIME_THRESHOLD_IDLE = 5 * 60 * 1000; // 5 minutes in ms
        const ACCURACY_THRESHOLD = 50; // meters — reject noisy GPS fixes
        const JITTER_THRESHOLD = 10;   // meters — minimum meaningful movement

        // ─── STEP 1: Filter out noisy GPS fixes ─────────────────────────
        const cleanLogs = logs.filter(log => {
            // Remove points with very poor accuracy
            if (log.accuracy && log.accuracy > ACCURACY_THRESHOLD) return false;
            // Remove invalid coordinates
            if (!log.latitude || !log.longitude) return false;
            return true;
        });

        if (cleanLogs.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    employeeId: userId, date,
                    totalDistance: 0, idleTime: 0, motionTime: 0,
                    stopDetails: [], route: []
                }
            });
        }

        // ─── STEP 2: Remove stationary jitter (dedup nearby points) ─────
        const dedupedLogs = [cleanLogs[0]];
        for (let i = 1; i < cleanLogs.length; i++) {
            const prev = dedupedLogs[dedupedLogs.length - 1];
            const curr = cleanLogs[i];
            const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            const elapsed = new Date(curr.timestamp) - new Date(prev.timestamp);

            // Keep point if: moved enough OR enough time has passed (heartbeat)
            if (dist >= JITTER_THRESHOLD || elapsed >= 5 * 60 * 1000) {
                dedupedLogs.push(curr);
            }
        }
        // Always include the last point for accurate timeline end
        if (dedupedLogs[dedupedLogs.length - 1] !== cleanLogs[cleanLogs.length - 1]) {
            dedupedLogs.push(cleanLogs[cleanLogs.length - 1]);
        }

        // ─── STEP 3: Ramer-Douglas-Peucker path simplification ─────────
        // Industry standard (used by Google Maps, Strava, Mapbox)
        // Reduces visual complexity while preserving the route's true shape.
        function perpendicularDistance(point, lineStart, lineEnd) {
            const x0 = point.latitude, y0 = point.longitude;
            const x1 = lineStart.latitude, y1 = lineStart.longitude;
            const x2 = lineEnd.latitude, y2 = lineEnd.longitude;
            const num = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
            const den = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
            // Convert lat/lng degree distance to approximate meters 
            return den === 0 ? 0 : (num / den) * 111320;
        }

        function rdpSimplify(points, epsilon) {
            if (points.length <= 2) return points;
            let maxDist = 0, maxIdx = 0;
            for (let i = 1; i < points.length - 1; i++) {
                const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
                if (d > maxDist) { maxDist = d; maxIdx = i; }
            }
            if (maxDist > epsilon) {
                const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
                const right = rdpSimplify(points.slice(maxIdx), epsilon);
                return left.slice(0, -1).concat(right);
            }
            return [points[0], points[points.length - 1]];
        }

        // Epsilon of 15m simplifies minor wiggles but keeps turns/direction changes
        const simplifiedLogs = rdpSimplify(dedupedLogs, 15);

        // ─── STEP 4: Compute stats from the deduped (not simplified) data ─
        previousLog = dedupedLogs[0];
        for (let i = 1; i < dedupedLogs.length; i++) {
            const currentLog = dedupedLogs[i];

            const dist = calculateDistance(
                previousLog.latitude, previousLog.longitude,
                currentLog.latitude, currentLog.longitude
            );

            const timeDiff = new Date(currentLog.timestamp) - new Date(previousLog.timestamp); // ms
            const timeDiffMin = timeDiff / (1000 * 60);

            if (dist > DISTANCE_THRESHOLD) {
                totalDistance += dist;
                motionTime += timeDiffMin;
            } else {
                idleTime += timeDiffMin;

                // If stayed in same place for > Idle Threshold, mark as stop
                if (timeDiff > TIME_THRESHOLD_IDLE) {
                    stopDetails.push({
                        latitude: currentLog.latitude,
                        longitude: currentLog.longitude,
                        startTime: previousLog.timestamp,
                        endTime: currentLog.timestamp,
                        duration: Math.round(timeDiffMin),
                        address: currentLog.address || "Unknown"
                    });
                }
            }
            previousLog = currentLog;
        }

        // ─── STEP 5: Build route from all clean logs (per user request to plot all locations) ────────────
        const route = cleanLogs.map(log => ({
            lat: log.latitude,
            lng: log.longitude,
            time: log.timestamp,
            battery: log.battery,
            accuracy: log.accuracy
        }));

        // Format Result
        const summary = {
            employeeId: userId,
            date,
            totalDistance: Number((totalDistance / 1000).toFixed(2)), // km
            idleTime: Math.round(idleTime),
            motionTime: Math.round(motionTime),
            stopDetails,
            route // Return cleaned route points for mapping
        };

        res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error("Timeline report error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get Calendar Report Data
exports.getCalendarReport = async (req, res) => {
    try {
        const { fromDate, toDate, userId } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ message: "From date and to date are required" });
        }

        // Parse dates properly to avoid timezone issues
        const [startYear, startMonth, startDay] = fromDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = toDate.split('-').map(Number);

        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

        if (startDate > endDate) {
            return res.status(400).json({ message: "From date cannot be after to date" });
        }

        // Users Fetching
        const { User, Attendance } = req.models;
        const userQuery = {};
        if (userId && userId !== "all") {
            userQuery._id = userId;
        }
        
        const users = await User.find(userQuery).select("name email");

        // Attendance Filter
        const attendanceQuery = {
            deviceTime: { $gte: startDate, $lte: endDate }
        };
        if (userId && userId !== "all") {
            attendanceQuery.userId = userId;
        }

        const rangeAttendance = await Attendance.find(attendanceQuery);

        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const reportsData = [];

        users.forEach(user => {
            const userAttendance = rangeAttendance.filter(a => a.userId && a.userId.toString() === user._id.toString());
            
            // Group by user and date
            const dailyRecords = {};
    
            userAttendance.forEach(record => {
                const dateStr = new Date(record.deviceTime).toISOString().split('T')[0];
    
                if (!dailyRecords[dateStr]) {
                    dailyRecords[dateStr] = {
                        checkIn: null,
                        checkOut: null,
                        status: "Absent",
                        workingHours: 0
                    };
                }
    
                if (record.attendanceType === "IN") {
                    dailyRecords[dateStr].checkIn = record.deviceTime;
                    dailyRecords[dateStr].status = "Present";
                } else if (record.attendanceType === "OUT") {
                    dailyRecords[dateStr].checkOut = record.deviceTime;
                    dailyRecords[dateStr].workingHours = record.workingHours || 0;
                }
            });
    
            let presentDays = Object.keys(dailyRecords).length;
            let absentDays = totalDays - presentDays;
            let totalWorkingHours = 0;
    
            // Construct calendar format array
            const calendarData = [];
            const loopDate = new Date(startDate);
            while (loopDate <= endDate) {
                // keep it in local logic
                const year = loopDate.getFullYear();
                const month = String(loopDate.getMonth() + 1).padStart(2, '0');
                const day = String(loopDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
    
                const record = dailyRecords[dateStr];
                
                if (record) {
                    totalWorkingHours += record.workingHours;
                }
                
                calendarData.push({
                    date: dateStr,
                    status: record ? record.status : "Absent",
                    checkIn: record ? record.checkIn : null,
                    checkOut: record ? record.checkOut : null,
                    workingHours: record ? record.workingHours : 0
                });
    
                loopDate.setDate(loopDate.getDate() + 1);
            }

            reportsData.push({
                 user: { _id: user._id, name: user.name, email: user.email },
                 totalDays,
                 presentDays,
                 absentDays,
                 totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
                 calendarData
            });
        });

        res.status(200).json({
            success: true,
            data: reportsData
        });
    } catch (error) {
        console.error("Calendar report error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get Dashboard Stats (All Users Total Distances/Times)
exports.getDashboardStats = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: "Date is required" });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const EmployeeLocationLog = req.models.EmployeeLocationLog;
        const { User } = req.models;
        const { calculateDistance } = require("../utils/geoFence");

        // Fetch all active tracking users
        const allUsers = await User.find().select("name employeeId email").lean();
        
        // Fetch all logs for the day
        const logs = await EmployeeLocationLog.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 }).lean();

        // Group logs by employeeId
        const logsByUser = {};
        logs.forEach(log => {
            const empId = log.employeeId.toString();
            if (!logsByUser[empId]) logsByUser[empId] = [];
            logsByUser[empId].push(log);
        });

        const DISTANCE_THRESHOLD = 20; // meters (to consider motion)
        const ACCURACY_THRESHOLD = 50; // meters — reject noisy GPS fixes
        const JITTER_THRESHOLD = 10;   // meters — minimum meaningful movement
        const userStats = [];

        // Aggregate Top level metrics
        let systemTotalDistance = 0;
        let systemMotionTime = 0;
        let systemIdleTime = 0;

        allUsers.forEach(user => {
            const rawLogs = logsByUser[user._id.toString()] || [];
            let totalDistance = 0; // meters
            let idleTime = 0; // minutes
            let motionTime = 0; // minutes

            // Apply same filtering as timeline report for consistent numbers
            const userLogs = rawLogs.filter(log => {
                if (log.accuracy && log.accuracy > ACCURACY_THRESHOLD) return false;
                if (!log.latitude || !log.longitude) return false;
                return true;
            });

            // Deduplicate jitter
            const dedupedLogs = userLogs.length > 0 ? [userLogs[0]] : [];
            for (let i = 1; i < userLogs.length; i++) {
                const prev = dedupedLogs[dedupedLogs.length - 1];
                const curr = userLogs[i];
                const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
                const elapsed = new Date(curr.timestamp) - new Date(prev.timestamp);
                if (dist >= JITTER_THRESHOLD || elapsed >= 5 * 60 * 1000) {
                    dedupedLogs.push(curr);
                }
            }
            
            if (dedupedLogs.length > 1) {
                let previousLog = dedupedLogs[0];
                for (let i = 1; i < dedupedLogs.length; i++) {
                    const currentLog = dedupedLogs[i];
                    const dist = calculateDistance(
                        previousLog.latitude, previousLog.longitude,
                        currentLog.latitude, currentLog.longitude
                    );
                    const timeDiff = new Date(currentLog.timestamp) - new Date(previousLog.timestamp);
                    const timeDiffMin = timeDiff / (1000 * 60);

                    if (dist > DISTANCE_THRESHOLD) {
                        totalDistance += dist;
                        motionTime += timeDiffMin;
                    } else {
                        idleTime += timeDiffMin;
                    }
                    previousLog = currentLog;
                }
            }

            const finalDistanceKm = Number((totalDistance / 1000).toFixed(2));
            const totalTime = Math.round(idleTime + motionTime);
            
            systemTotalDistance += parseFloat(finalDistanceKm);
            systemMotionTime += Math.round(motionTime);
            systemIdleTime += Math.round(idleTime);

            userStats.push({
                _id: user._id,
                name: user.name,
                employeeId: user.employeeId || "",
                totalDistance: finalDistanceKm, // km
                totalTime: totalTime, // minutes
                motionTime: Math.round(motionTime), // minutes
                idleTime: Math.round(idleTime) // minutes
            });
        });

        res.status(200).json({
            success: true,
            date: date,
            summary: {
                totalDistance: Number(systemTotalDistance.toFixed(2)),
                totalTime: systemMotionTime + systemIdleTime,
                totalMotionTime: systemMotionTime,
                totalIdleTime: systemIdleTime
            },
            data: userStats
        });

    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ message: error.message });
    }
};

