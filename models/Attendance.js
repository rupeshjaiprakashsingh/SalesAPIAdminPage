const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  attendanceType: { type: String, enum: ["IN", "OUT"], required: true },

  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  locationAccuracy: { type: Number },

  deviceTime: { type: Date, required: true },
  serverTime: { type: Date, default: Date.now },

  deviceId: { type: String, required: true },

  address: { type: String },
  batteryPercentage: { type: Number },
  networkType: { type: String },
  remarks: { type: String },

  validatedInsideGeoFence: { type: Boolean, default: false },
  ipAddress: { type: String },

  workingHours: { type: Number }, // In hours (e.g., 7.5)
  status: {
    type: String,
    enum: ["Present", "Half Day", "Absent", "Full Day"],
    default: "Present"
  },

}, { timestamps: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
