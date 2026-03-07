const mongoose = require("mongoose");

const employeeRouteSummarySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },

    totalDistance: { type: Number, default: 0 }, // in km or meters
    idleTime: { type: Number, default: 0 }, // in minutes
    motionTime: { type: Number, default: 0 }, // in minutes

    stopDetails: [{
        latitude: Number,
        longitude: Number,
        startTime: Date,
        endTime: Date,
        duration: Number, // in minutes
        address: String
    }],

    rawData: [{ type: mongoose.Schema.Types.Mixed }] // Optional: store source logs
}, { timestamps: true });

// Compound index for quick lookup
employeeRouteSummarySchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("EmployeeRouteSummary", employeeRouteSummarySchema);
