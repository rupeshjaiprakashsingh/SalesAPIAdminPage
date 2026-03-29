// Models now come from req.models (tenant-specific)
// const Attendance and User removed
const { isInsideGeofence } = require("../utils/geoFence");

// =========================================================
// ADMIN MANUAL ADD ATTENDANCE
// Admin-only: select a user + status, system fills defaults
// =========================================================
exports.adminAddAttendance = async (req, res) => {
  try {
    // Only admins can use this route
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const { User, Attendance } = req.models;
    const { userId, status, date, remarks } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const validStatuses = ["Present", "Half Day", "Absent"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be one of: Present, Half Day, Absent" });
    }

    // Verify the user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Determine the date to use (default = today IST)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    let attendanceDate;
    if (date) {
      // date is expected as YYYY-MM-DD string
      attendanceDate = new Date(date + "T09:00:00.000Z"); // 9am UTC = 2:30pm IST approx
    } else {
      const nowIST = new Date(Date.now() + IST_OFFSET);
      const yyyy = nowIST.getUTCFullYear();
      const mm = String(nowIST.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(nowIST.getUTCDate()).padStart(2, '0');
      attendanceDate = new Date(`${yyyy}-${mm}-${dd}T09:00:00.000Z`);
    }

    // Working hours by status
    let workingHours = 0;
    if (status === "Present") workingHours = 8;
    else if (status === "Half Day") workingHours = 4;
    else workingHours = 0;

    // Default/placeholder values for required model fields
    const DEFAULT_LAT = 0;
    const DEFAULT_LNG = 0;
    const DEFAULT_DEVICE_ID = `admin-manual-${Date.now()}`;
    const inTime = new Date(attendanceDate.getTime());           // 9:00 AM IST
    const outTime = new Date(attendanceDate.getTime() + workingHours * 60 * 60 * 1000); // IN + workingHours

    // Build IN record
    const inRecord = new Attendance({
      userId,
      attendanceType: "IN",
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      locationAccuracy: 0,
      deviceTime: inTime,
      deviceId: DEFAULT_DEVICE_ID,
      address: "Manually added by Admin",
      batteryPercentage: null,
      networkType: "MANUAL",
      remarks: remarks || "Manually added by Admin",
      ipAddress: req.ip,
      validatedInsideGeoFence: false,
      status: "Present",
    });

    // Build OUT record (only if not Absent)
    let outRecord = null;
    if (status !== "Absent") {
      outRecord = new Attendance({
        userId,
        attendanceType: "OUT",
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LNG,
        locationAccuracy: 0,
        deviceTime: outTime,
        deviceId: DEFAULT_DEVICE_ID,
        address: "Manually added by Admin",
        batteryPercentage: null,
        networkType: "MANUAL",
        remarks: remarks || "Manually added by Admin",
        ipAddress: req.ip,
        validatedInsideGeoFence: false,
        workingHours,
        status,
      });
    } else {
      // For Absent: just an IN record with Absent status
      inRecord.status = "Absent";
    }

    await inRecord.save();
    if (outRecord) await outRecord.save();

    return res.status(201).json({
      message: `Attendance marked as ${status} for ${targetUser.name}`,
      in: inRecord,
      out: outRecord || null,
    });

  } catch (error) {
    console.error("[adminAddAttendance] Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Mark Attendance (IN/OUT)
exports.markAttendance = async (req, res) => {
  try {
    const { Attendance, User } = req.models;
    const userId = req.user.id; // Get from JWT
    const ipAddress = req.ip;

    let {
      attendanceType,
      latitude,
      longitude,
      deviceTime,
      deviceId,
      locationAccuracy,
      address,
      batteryPercentage,
      networkType,
      remarks,
    } = req.body;

    // Use Server Time (IST)
    const serverTime = new Date();
    // Adjust for IST (UTC+5:30) if server is in UTC, or just use server time if it's already local.
    // For consistency, we'll store the Date object as is (UTC in Mongo), but calculations for "today" will be IST based.

    // IST Offset in milliseconds (5 hours 30 minutes)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(serverTime.getTime() + IST_OFFSET);

    const startOfDay = new Date(istDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    startOfDay.setTime(startOfDay.getTime() - IST_OFFSET); // Convert back to UTC for query

    const endOfDay = new Date(istDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    endOfDay.setTime(endOfDay.getTime() - IST_OFFSET); // Convert back to UTC for query

    console.log(`[Attendance] Request: ${attendanceType}, User: ${userId}, Server Time: ${serverTime.toISOString()}`);

    // -------- Mandatory Validation ----------
    // Removed deviceTime from mandatory check as we override it
    if (!attendanceType || !latitude || !longitude || !deviceId) {
      return res.status(400).json({ message: "Mandatory fields missing" });
    }

    // Duplicate Check for same day (Only for IN)
    // We do this BEFORE time restriction, because if they already marked IN, 
    // we want to switch them to OUT (which is allowed after 12:30 PM).
    if (attendanceType === "IN") {
      const alreadyMarkedIn = await Attendance.findOne({
        userId,
        attendanceType: "IN",
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (alreadyMarkedIn) {
        console.log(`[Attendance] Duplicate IN found. Switching to OUT.`);
        attendanceType = "OUT";
      }
    }



    // Check if OUT before IN
    if (attendanceType === "OUT") {
      const inMarked = await Attendance.findOne({
        userId,
        attendanceType: "IN",
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (!inMarked) {
        return res.status(400).json({ message: "You must mark IN before OUT" });
      }

      const alreadyMarkedOut = await Attendance.findOne({
        userId,
        attendanceType: "OUT",
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (alreadyMarkedOut) {
        return res.status(400).json({ message: "You already did checkout." });
      }
    }

    // ---------------------------------------------------------
    // PERMANENT DEVICE LOCK (One User = One Device Forever)
    // ---------------------------------------------------------
    const currentUser = await User.findById(userId);

    if (!currentUser.deviceId) {
      // First time marking attendance? Bind this device to user.
      currentUser.deviceId = deviceId;
      await currentUser.save();
    } else if (currentUser.deviceId !== deviceId) {
      // Device mismatch! Block access.
      console.log(`[Attendance] Device Mismatch! User ${userId} tried device ${deviceId} but is locked to ${currentUser.deviceId}`);
      return res.status(403).json({
        message: "Device mismatch. You are locked to another device. Contact Admin to reset."
      });
    }

    // ---------------------------------------------------------
    // PREVENT PROXY ATTENDANCE (One Device = One User Per Day)
    // ---------------------------------------------------------
    const deviceUsedByOther = await Attendance.findOne({
      deviceId,
      userId: { $ne: userId }, // Not the current user
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (deviceUsedByOther) {
      console.log(`[Attendance] Proxy Attempt Blocked! Device ${deviceId} used by another user today.`);
      return res.status(403).json({
        message: "This device has already been used by another user today. Proxy attendance is not allowed."
      });
    }

    // Geofence Validation
    const insideFence = isInsideGeofence(latitude, longitude);



    // Calculate Working Hours if OUT
    let workingHours = 0;
    let status = "Present";

    if (attendanceType === "OUT") {
      const inRecord = await Attendance.findOne({
        userId,
        attendanceType: "IN",
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (inRecord) {
        const ms = serverTime - new Date(inRecord.deviceTime);
        workingHours = ms / (1000 * 60 * 60); // Hours

        // ---------------------------------------------------------
        // 4-HOUR RESTRICTION CHECK
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // REMOVED 4-HOUR RESTRICTION (Allowed with Absent status)
        // ---------------------------------------------------------

        if (workingHours >= 8) {
          status = "Full Day";
        } else {
          status = "Absent";
        }
      }
    }

    // Create Attendance Entry
    const record = new Attendance({
      userId,
      attendanceType,
      latitude,
      longitude,
      deviceTime: serverTime, // Overwrite with Server Time
      deviceId,
      locationAccuracy,
      address,
      batteryPercentage,
      networkType,
      remarks,
      ipAddress,
      validatedInsideGeoFence: insideFence,
      workingHours: attendanceType === "OUT" ? workingHours : undefined,
      status: attendanceType === "OUT" ? status : "Present",
    });

    await record.save();

    // Update User.isOnline status and lastLocation based on attendance type
    if (attendanceType === "OUT") {
      await User.findByIdAndUpdate(userId, { 
        isOnline: false,
        lastLocation: { lat: latitude, lng: longitude, timestamp: serverTime },
        batteryStatus: batteryPercentage ?? undefined
      });
    } else if (attendanceType === "IN") {
      await User.findByIdAndUpdate(userId, { 
        isOnline: true,
        lastLocation: { lat: latitude, lng: longitude, timestamp: serverTime },
        batteryStatus: batteryPercentage ?? undefined
      });
    }

    res.status(201).json({
      message: `${attendanceType} marked successfully`,
      insideOffice: insideFence,
      data: record,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL ATTENDANCE (Admin or Global View) - Merged by Day
exports.getAllAttendance = async (req, res) => {
  try {
    const { Attendance } = req.models;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build match stage for RBAC
    let matchStage = {};
    if (req.user.role !== "admin") {
      const mongoose = require('mongoose');
      matchStage.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    // Aggregation pipeline to merge IN/OUT by day
    const pipeline = [
      // Stage 1: Match based on role
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),

      // Stage 2: Add dateStr field (YYYY-MM-DD)
      {
        $addFields: {
          dateStr: {
            $dateToString: { format: "%Y-%m-%d", date: "$deviceTime" }
          }
        }
      },

      // Stage 3: Sort by deviceTime to ensure proper ordering within groups
      { $sort: { deviceTime: 1 } },

      // Stage 4: Group by userId and dateStr
      {
        $group: {
          _id: { userId: "$userId", dateStr: "$dateStr" },
          inRecord: {
            $first: {
              $cond: [
                { $eq: ["$attendanceType", "IN"] },
                "$$ROOT",
                null
              ]
            }
          },
          outRecord: {
            $first: {
              $cond: [
                { $eq: ["$attendanceType", "OUT"] },
                "$$ROOT",
                null
              ]
            }
          },
          allRecords: { $push: "$$ROOT" }
        }
      },

      // Stage 5: Project to extract IN and OUT from allRecords
      {
        $project: {
          userId: "$_id.userId",
          dateStr: "$_id.dateStr",
          inRecord: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$allRecords",
                  as: "record",
                  cond: { $eq: ["$$record.attendanceType", "IN"] }
                }
              },
              0
            ]
          },
          outRecord: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$allRecords",
                  as: "record",
                  cond: { $eq: ["$$record.attendanceType", "OUT"] }
                }
              },
              0
            ]
          }
        }
      },

      // Stage 6: Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails"
        }
      },

      // Stage 7: Unwind user details
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true
        }
      },

      // Stage 8: Sort by date descending, then by Name ascending
      { $sort: { dateStr: -1, "userDetails.name": 1 } },

      // Stage 9: Facet for pagination and total count
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await Attendance.aggregate(pipeline);

    const total = result[0]?.metadata[0]?.total || 0;
    const records = result[0]?.data || [];

    res.status(200).json({
      success: true,
      total,
      page,
      limit,
      records,
    });

  } catch (error) {
    console.error("Aggregation error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getDailyAttendance = async (req, res) => {
  try {
    const { Attendance, User } = req.models;
    const { userId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "date query param is required (YYYY-MM-DD)"
      });
    }

    // Create local date range
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get user only once
    const user = await User.findById(userId).select("name email");

    // Fetch IN record (no populate)
    const inRecord = await Attendance.findOne({
      userId,
      attendanceType: "IN",
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    // Fetch OUT record (no populate)
    const outRecord = await Attendance.findOne({
      userId,
      attendanceType: "OUT",
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    // Remove userId from IN/OUT
    if (inRecord) delete inRecord.userId;
    if (outRecord) delete outRecord.userId;

    // Calculate duration
    let totalHours = null;
    if (inRecord && outRecord) {
      const ms = new Date(outRecord.deviceTime) - new Date(inRecord.deviceTime);
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      totalHours = `${hours}h ${minutes}m`;
    }

    return res.status(200).json({
      success: true,
      date,
      user,
      in: inRecord || null,
      out: outRecord || null,
      totalHours
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE Single Attendance
exports.deleteAttendance = async (req, res) => {
  try {
    const { Attendance } = req.models;
    const { id } = req.params;
    await Attendance.findByIdAndDelete(id);
    res.status(200).json({ message: "Record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE Multiple Attendance
exports.deleteMultipleAttendance = async (req, res) => {
  try {
    const { Attendance } = req.models;
    const { ids } = req.body; // Expect array of IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    await Attendance.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: "Records deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE Attendance
exports.updateAttendance = async (req, res) => {
  try {
    const { Attendance } = req.models;
    const { id } = req.params;
    const updates = req.body;

    const record = await Attendance.findByIdAndUpdate(id, updates, { new: true });
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json({ message: "Record updated successfully", record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET LIVE LOCATIONS — Staff who checked IN today and their current location
// Uses IST-aware date window to find today's check-ins.
// Priority: User.lastLocation (most recent GPS ping) → check-in location (fallback)
exports.getLiveLocations = async (req, res) => {
  try {
    const { Attendance } = req.models;

    // Build IST-aware "today" window
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const istDate = new Date(nowUTC.getTime() + IST_OFFSET);

    const startOfDayIST = new Date(istDate);
    startOfDayIST.setUTCHours(0, 0, 0, 0);
    const startOfDayUTC = new Date(startOfDayIST.getTime() - IST_OFFSET);

    const endOfDayIST = new Date(istDate);
    endOfDayIST.setUTCHours(23, 59, 59, 999);
    const endOfDayUTC = new Date(endOfDayIST.getTime() - IST_OFFSET);

    const pipeline = [
      // 1. Match only today's IN records
      {
        $match: {
          attendanceType: "IN",
          createdAt: { $gte: startOfDayUTC, $lte: endOfDayUTC }
        }
      },

      // 2. Sort by most recent first (handles duplicate INs gracefully)
      { $sort: { createdAt: -1 } },

      // 3. Group by userId — keep only the latest IN per user
      {
        $group: {
          _id: "$userId",
          inRecord: { $first: "$$ROOT" }
        }
      },

      // 4. Lookup today's OUT record for each user
      {
        $lookup: {
          from: "attendances",
          let: { uid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$userId", "$$uid"] },
                attendanceType: "OUT",
                createdAt: { $gte: startOfDayUTC, $lte: endOfDayUTC }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "outRecords"
        }
      },

      // 5. Lookup User info (for lastLocation, batteryStatus, isOnline)
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: false } },

      // 6. Project final fields
      {
        $project: {
          _id: 0,
          userId: "$_id",
          name: "$userDetails.name",
          email: "$userDetails.email",
          mobileNumber: "$userDetails.mobileNumber",

          // Live location: prefer User.lastLocation only if it is newer than the check-in time
          latitude: {
            $cond: [
              { $gt: ["$userDetails.lastLocation.timestamp", "$inRecord.deviceTime"] },
              "$userDetails.lastLocation.lat",
              "$inRecord.latitude"
            ]
          },
          longitude: {
            $cond: [
              { $gt: ["$userDetails.lastLocation.timestamp", "$inRecord.deviceTime"] },
              "$userDetails.lastLocation.lng",
              "$inRecord.longitude"
            ]
          },
          lastLocationUpdated: {
            $cond: [
              { $gt: ["$userDetails.lastLocation.timestamp", "$inRecord.deviceTime"] },
              "$userDetails.lastLocation.timestamp",
              "$inRecord.deviceTime"
            ]
          },

          // Battery from User.batteryStatus (updated on every GPS ping)
          battery: {
            $ifNull: ["$userDetails.batteryStatus", "$inRecord.batteryPercentage"]
          },

          // Online status from User model (set to true on GPS ping)
          isOnline: { $ifNull: ["$userDetails.isOnline", false] },

          // Attendance info
          checkInTime: "$inRecord.deviceTime",
          checkInAddress: "$inRecord.address",
          checkInLocation: {
            lat: "$inRecord.latitude",
            lng: "$inRecord.longitude"
          },

          // Checkout info (null if not checked out yet)
          checkedOut: { $gt: [{ $size: "$outRecords" }, 0] },
          checkOutTime: { $arrayElemAt: ["$outRecords.deviceTime", 0] },
          checkOutAddress: { $arrayElemAt: ["$outRecords.address", 0] },
          workingHours: { $arrayElemAt: ["$outRecords.workingHours", 0] },

          geofenceValidated: "$inRecord.validatedInsideGeoFence"
        }
      },

      // 7. Sort: currently checked-in (not yet out) first, then online, then by checkInTime
      { $sort: { checkedOut: 1, isOnline: -1, checkInTime: -1 } }
    ];

    const locations = await Attendance.aggregate(pipeline);

    res.status(200).json({
      success: true,
      count: locations.length,
      checkedInCount: locations.filter(l => !l.checkedOut).length,
      checkedOutCount: locations.filter(l => l.checkedOut).length,
      data: locations
    });
  } catch (error) {
    console.error("[getLiveLocations] Error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMonthlyAttendanceUser = async (req, res) => {
  try {
    const { Attendance, User } = req.models;
    const { userId } = req.params;
    const { month } = req.query; // e.g., "YYYY-MM"

    if (!month) {
      return res.status(400).json({ message: "month query param is required (YYYY-MM)" });
    }

    const startOfMonth = new Date(`${month}-01T00:00:00.000Z`);
    
    // next month start
    const [y_str, m_str] = month.split("-");
    let y = parseInt(y_str);
    let m = parseInt(m_str);
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
    const nextMonth = `${y}-${String(m).padStart(2, "0")}`;
    const endOfMonth = new Date(`${nextMonth}-01T00:00:00.000Z`);
    
    // fetch user details
    const user = await User.findById(userId).select("name email employee_id");

    const pipeline = [
      {
        $match: {
          $expr: { $eq: ["$userId", { $toObjectId: userId }] },
          createdAt: { $gte: startOfMonth, $lt: endOfMonth }
        }
      },
      {
        $addFields: {
          dateStr: {
            $dateToString: { format: "%Y-%m-%d", date: "$deviceTime" }
          }
        }
      },
      { $sort: { deviceTime: 1 } },
      {
        $group: {
          _id: "$dateStr",
          inRecord: {
            $first: { $cond: [{ $eq: ["$attendanceType", "IN"] }, "$$ROOT", null] }
          },
          outRecord: {
            $first: { $cond: [{ $eq: ["$attendanceType", "OUT"] }, "$$ROOT", null] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          in: "$inRecord",
          out: "$outRecord"
        }
      },
      { $sort: { date: 1 } }
    ];

    const records = await Attendance.aggregate(pipeline);

    res.status(200).json({
      success: true,
      user,
      month,
      records
    });
  } catch (err) {
    console.error("Monthly attendance error", err);
    res.status(500).json({ message: err.message });
  }
};
