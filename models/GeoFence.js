const mongoose = require("mongoose");

const geoFenceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    center: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    radius: { type: Number, required: true, default: 200 }, // in meters
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("GeoFence", geoFenceSchema);
