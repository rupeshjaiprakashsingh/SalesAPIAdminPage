// Models now come from req.models (tenant-specific)
// const Attendance and User removed
const { isInsideGeofence } = require("../utils/geoFence");
const { sendEmail } = require("../utils/emailService");
const { sendPushNotification } = require("../utils/notificationService");

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
    const { userId, status, date, remarks, inTime: customInTime, outTime: customOutTime } = req.body;

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
      attendanceDate = new Date(date + "T00:00:00.000Z");
    } else {
      const nowIST = new Date(Date.now() + IST_OFFSET);
      const yyyy = nowIST.getUTCFullYear();
      const mm = String(nowIST.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(nowIST.getUTCDate()).padStart(2, '0');
      attendanceDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    }

    // Window for matching (same day IST)
    const startOfDay = new Date(attendanceDate);
    const endOfDay = new Date(attendanceDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Working hours by status if not specified
    let defaultWorkingHours = 0;
    if (status === "Present") defaultWorkingHours = 8;
    else if (status === "Half Day") defaultWorkingHours = 4;
    else defaultWorkingHours = 0;

    const DEFAULT_LAT = 0;
    const DEFAULT_LNG = 0;
    const DEFAULT_DEVICE_ID = `admin-manual-${Date.now()}`;

    // 1. Handle IN Record
    let finalInTime = customInTime ? new Date(customInTime) : new Date(attendanceDate.getTime() + 9 * 60 * 60 * 1000); // Default 9 AM IST

    const inUpdatePayload = {
      userId,
      attendanceType: "IN",
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      locationAccuracy: 0,
      deviceTime: finalInTime,
      deviceId: DEFAULT_DEVICE_ID,
      address: "Manually added by Admin",
      batteryPercentage: null,
      networkType: "MANUAL",
      remarks: remarks || "Manually added by Admin",
      ipAddress: req.ip,
      validatedInsideGeoFence: false,
      status: status === "Absent" ? "Absent" : "Present",
    };

    const inRecord = await Attendance.findOneAndUpdate(
      {
        userId,
        attendanceType: "IN",
        deviceTime: { $gte: startOfDay, $lte: endOfDay }
      },
      { $set: inUpdatePayload },
      { upsert: true, new: true }
    );

    // 2. Handle OUT Record (only if not Absent)
    let outRecord = null;
    if (status !== "Absent") {
      let finalOutTime = customOutTime ? new Date(customOutTime) : new Date(finalInTime.getTime() + defaultWorkingHours * 60 * 60 * 1000);
      
      // Calculate working hours
      const diffMs = finalOutTime.getTime() - finalInTime.getTime();
      const workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal

      const outUpdatePayload = {
        userId,
        attendanceType: "OUT",
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LNG,
        locationAccuracy: 0,
        deviceTime: finalOutTime,
        deviceId: DEFAULT_DEVICE_ID,
        address: "Manually added by Admin",
        batteryPercentage: null,
        networkType: "MANUAL",
        remarks: remarks || "Manually added by Admin",
        ipAddress: req.ip,
        validatedInsideGeoFence: false,
        workingHours,
        status: status,
      };

      outRecord = await Attendance.findOneAndUpdate(
        {
          userId,
          attendanceType: "OUT",
          deviceTime: { $gte: startOfDay, $lte: endOfDay }
        },
        { $set: outUpdatePayload },
        { upsert: true, new: true }
      );
    } else {
      // If switching to Absent, remove OUT record if it exists for this day
      await Attendance.findOneAndDelete({
        userId,
        attendanceType: "OUT",
        deviceTime: { $gte: startOfDay, $lte: endOfDay }
      });
    }

    return res.status(200).json({
      message: `Attendance updated as ${status} for ${targetUser.name}`,
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
      photoBase64,
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
    if (!attendanceType || !latitude || !longitude) {
      return res.status(400).json({ message: "Mandatory fields missing" });
    }

    // Duplicate Check for same day (Only for IN)
    // We do this BEFORE time restriction, because if they already marked IN, 
    // we want to switch them to OUT (which is allowed after 12:30 PM).
    // NOTE: Rejected records are excluded — a rejected punch lets the user try again.
    if (attendanceType === "IN") {
      const alreadyMarkedIn = await Attendance.findOne({
        userId,
        attendanceType: "IN",
        approvalStatus: { $ne: "Rejected" }, // Rejected INs don't block a new punch
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
      // Approved or Pending IN record must exist — Rejected IN does not count
      const inMarked = await Attendance.findOne({
        userId,
        attendanceType: "IN",
        approvalStatus: { $ne: "Rejected" }, // Rejected IN = as if never punched
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (!inMarked) {
        return res.status(400).json({ message: "You must mark IN before OUT" });
      }

      // Already checked OUT? Only block if that OUT is NOT Rejected
      const alreadyMarkedOut = await Attendance.findOne({
        userId,
        attendanceType: "OUT",
        approvalStatus: { $ne: "Rejected" }, // Rejected OUT = user may punch out again
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
    // PERMANENT DEVICE LOCK & PROXY CHECK REMOVED
    // User requested to remove all device mismatch checking logic.
    // ---------------------------------------------------------

    // Geofence Validation
    const insideFence = isInsideGeofence(latitude, longitude);



    // Calculate Working Hours if OUT
    let workingHours = 0;
    let status = "Present";

    if (attendanceType === "OUT") {
      // Find the most recent non-rejected IN record to calculate working hours
      const inRecord = await Attendance.findOne({
        userId,
        attendanceType: "IN",
        approvalStatus: { $ne: "Rejected" },
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      if (inRecord) {
        const ms = serverTime - new Date(inRecord.deviceTime);
        workingHours = ms / (1000 * 60 * 60); // Hours

        if (workingHours >= 8) {
          status = "Full Day";
        } else {
          status = "Absent";
        }
      }
    }

    // Process photo payload
    let photoUrl = undefined;
    if (photoBase64) {
      // Guard: reject photos > 5MB (base64 is ~4/3 the size of the original)
      // 5MB base64 string ≈ 6.7MB raw, but we keep the check on the base64 string length
      const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
      if (photoBase64.length > MAX_PHOTO_BYTES) {
        return res.status(400).json({ message: "Photo is too large. Please use a smaller image (max 5MB)." });
      }
      // Save Base64 directly to MongoDB to avoid ephemeral disk wipes on Render hosting
      photoUrl = photoBase64;
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
      photoUrl,
      workingHours: attendanceType === "OUT" ? workingHours : undefined,
      status: "Pending", // Default to Pending for Review workflow
      approvalStatus: "Pending"
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

    let dateMatch = {};
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      dateMatch.dateStr = {};
      if (startDate) dateMatch.dateStr.$gte = startDate;
      if (endDate) dateMatch.dateStr.$lte = endDate;
    }

    // Aggregation pipeline to merge IN/OUT by day
    const pipeline = [
      // Stage 1: Match based on role
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),

      // Stage 2: Add dateStr field (YYYY-MM-DD)
      {
        $addFields: {
          dateStr: {
            $dateToString: { format: "%Y-%m-%d", date: "$deviceTime", timezone: "+05:30" }
          }
        }
      },

      // Stage 2.5: Filter by Date
      ...(Object.keys(dateMatch).length > 0 ? [{ $match: dateMatch }] : []),


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
      // Priority: latest non-Rejected record → falls back to latest of any status.
      // This ensures that after a rejection + re-punch, the NEW Pending record is shown,
      // not the old Rejected record (which was at index 0 in ascending deviceTime order).
      {
        $project: {
          userId: "$_id.userId",
          dateStr: "$_id.dateStr",
          inRecord: {
            $let: {
              vars: {
                allIns: {
                  $filter: { input: "$allRecords", as: "r", cond: { $eq: ["$$r.attendanceType", "IN"] } }
                }
              },
              in: {
                $ifNull: [
                  // Prefer: last (most recent) non-Rejected IN
                  {
                    $arrayElemAt: [
                      { $filter: { input: "$$allIns", as: "r", cond: { $ne: ["$$r.approvalStatus", "Rejected"] } } },
                      -1
                    ]
                  },
                  // Fallback: last (most recent) IN of any status
                  { $arrayElemAt: ["$$allIns", -1] }
                ]
              }
            }
          },
          outRecord: {
            $let: {
              vars: {
                allOuts: {
                  $filter: { input: "$allRecords", as: "r", cond: { $eq: ["$$r.attendanceType", "OUT"] } }
                }
              },
              in: {
                $ifNull: [
                  // Prefer: last (most recent) non-Rejected OUT
                  {
                    $arrayElemAt: [
                      { $filter: { input: "$$allOuts", as: "r", cond: { $ne: ["$$r.approvalStatus", "Rejected"] } } },
                      -1
                    ]
                  },
                  // Fallback: last (most recent) OUT of any status
                  { $arrayElemAt: ["$$allOuts", -1] }
                ]
              }
            }
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
          allRecords: { $push: "$$ROOT" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          // Prefer latest non-Rejected IN; fallback to latest IN of any status
          in: {
            $let: {
              vars: {
                allIns: { $filter: { input: "$allRecords", as: "r", cond: { $eq: ["$$r.attendanceType", "IN"] } } }
              },
              in: {
                $ifNull: [
                  { $arrayElemAt: [{ $filter: { input: "$$allIns", as: "r", cond: { $ne: ["$$r.approvalStatus", "Rejected"] } } }, -1] },
                  { $arrayElemAt: ["$$allIns", -1] }
                ]
              }
            }
          },
          // Prefer latest non-Rejected OUT; fallback to latest OUT of any status
          out: {
            $let: {
              vars: {
                allOuts: { $filter: { input: "$allRecords", as: "r", cond: { $eq: ["$$r.attendanceType", "OUT"] } } }
              },
              in: {
                $ifNull: [
                  { $arrayElemAt: [{ $filter: { input: "$$allOuts", as: "r", cond: { $ne: ["$$r.approvalStatus", "Rejected"] } } }, -1] },
                  { $arrayElemAt: ["$$allOuts", -1] }
                ]
              }
            }
          }
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

// Admin Approve/Reject Attendance
exports.approveAttendance = async (req, res) => {
  try {
    const { Attendance } = req.models;
    const { ids, approvalStatus, remarks } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Attendance IDs (array) are required" });
    }

    if (!["Approved", "Rejected"].includes(approvalStatus)) {
      return res.status(400).json({ message: "Invalid approval status" });
    }

    const targetStatus = approvalStatus === "Approved" ? "Present" : "Absent";

    const updatePayload = {
      approvalStatus,
      status: targetStatus,
      approvedBy: req.user.id,
      approvalDate: new Date(),
      remarks: remarks || `Status set to ${approvalStatus} by admin`
    };

    // Find records before updating to send notifications
    const recordsToUpdate = await Attendance.find({ _id: { $in: ids } }).populate("userId", "name email fcmToken");
    
    // Group by user to avoid duplicate notifications
    const notifiedUsers = new Set();

    for (const record of recordsToUpdate) {
        const user = record.userId;
        if (!user) continue;

        if (!notifiedUsers.has(user._id.toString())) {
            notifiedUsers.add(user._id.toString());

            const title = `Attendance ${approvalStatus}`;
            const body = `Your attendance for ${new Date(record.deviceTime).toLocaleDateString()} has been ${approvalStatus.toLowerCase()}.`;

            // Push Notification
            if (user.fcmToken) {
                sendPushNotification(user.fcmToken, title, body, {
                    type: "ATTENDANCE_APPROVAL",
                    status: approvalStatus
                });
            }

            // Email Notification
            if (user.email) {
                const emailHtml = `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
                   <div style="max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; border-top: 4px solid ${approvalStatus === 'Approved' ? '#2563eb' : '#ef4444'}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      <h2 style="color: #111827; margin-top: 0;">Attendance ${approvalStatus}</h2>
                      <p style="color: #4b5563; font-size: 15px;">Hello <b>${user.name}</b>,</p>
                      <p style="color: #4b5563; font-size: 15px;">Your attendance record on <b>${new Date(record.deviceTime).toLocaleDateString()}</b> has been <strong>${approvalStatus.toLowerCase()}</strong> by the administrator.</p>
                      ${remarks ? `<div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 20px 0;"><p style="margin:0; color:#374151; font-size:14px;"><b>Remarks:</b> ${remarks}</p></div>` : ''}
                      <p style="margin-top: 30px; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 15px;">You can view the full details in your mobile app.</p>
                   </div>
                </div>
                `;
                sendEmail(user.email, title, emailHtml);
            }
        }
    }

    const result = await Attendance.updateMany(
      { _id: { $in: ids } },
      { $set: updatePayload }
    );

    res.status(200).json({
      success: true,
      message: `Successfully ${approvalStatus.toLowerCase()} ${result.modifiedCount} records`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Approve Attendance Error:", err);
    res.status(500).json({ message: err.message });
  }
};
