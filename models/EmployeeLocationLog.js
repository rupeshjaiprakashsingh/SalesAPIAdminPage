const mongoose = require("mongoose");

const locationLogSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    battery: { type: Number },
    timestamp: { type: Date, default: Date.now }
});

// Index for efficient querying of latest location
locationLogSchema.index({ employeeId: 1, timestamp: -1 });

module.exports = mongoose.model("EmployeeLocationLog", locationLogSchema);
