const mongoose = require("mongoose");

const geoFenceLogSchema = new mongoose.Schema({
    fenceId: { type: mongoose.Schema.Types.ObjectId, ref: "GeoFence", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    entryTime: { type: Date, default: Date.now },
    exitTime: { type: Date },

    status: { type: String, enum: ["INSIDE", "COMPLETED"], default: "INSIDE" }
}, { timestamps: true });

// Index for finding active sessions quickly
geoFenceLogSchema.index({ fenceId: 1, userId: 1, exitTime: 1 });

module.exports = mongoose.model("GeoFenceLog", geoFenceLogSchema);
