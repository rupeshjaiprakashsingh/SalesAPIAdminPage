const mongoose = require("mongoose");

const locationLogSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    latitude:   { type: Number, required: true },
    longitude:  { type: Number, required: true },
    accuracy:   { type: Number },
    speed:      { type: Number },
    battery:    { type: Number },
    timestamp:  { type: Date, default: Date.now }
});

// Compound index for fast queries: "latest location per user"
locationLogSchema.index({ employeeId: 1, timestamp: -1 });

// TTL index: MongoDB auto-deletes documents older than 7 days — keeps free tier lean
locationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("EmployeeLocationLog", locationLogSchema);
