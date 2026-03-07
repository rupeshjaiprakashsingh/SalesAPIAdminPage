const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { isInsideGeofence } = require("../utils/geoFence");

// Mark Attendance (IN/OUT)
exports.markAttendance = async (req, res) => {
  try {
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

// GET LIVE LOCATIONS (Latest location for each user)
exports.getLiveLocations = async (req, res) => {
  try {
    const pipeline = [
      // 1. Sort by latest first
      { $sort: { deviceTime: -1 } },

      // 2. Group by user to get the latest record
      {
        $group: {
          _id: "$userId",
          latestRecord: { $first: "$$ROOT" }
        }
      },

      // 3. Lookup User info
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },

      // 4. Unwind user details
      { $unwind: "$userDetails" },

      // 5. Project specific fields
      {
        $project: {
          userId: "$_id",
          name: "$userDetails.name",
          email: "$userDetails.email",
          latitude: "$latestRecord.latitude",
          longitude: "$latestRecord.longitude",
          lastSeen: "$latestRecord.deviceTime",
          status: "$latestRecord.attendanceType", // IN or OUT
          battery: "$latestRecord.batteryPercentage",
          address: "$latestRecord.address"
        }
      }
    ];

    const locations = await Attendance.aggregate(pipeline);

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
