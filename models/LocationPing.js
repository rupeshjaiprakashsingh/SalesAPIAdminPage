const mongoose = require("mongoose");

const LocationPingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    accuracy: {
        type: Number,
        default: 0
    },
    speed: {
        type: Number,
        default: 0
    },
    heading: {
        type: Number,
        default: 0
    },
    batteryPercentage: {
        type: Number
    },
    deviceId: {
        type: String
    },
    timestamp: {
        type: Date,
        required: true
    },
    isMock: {
        type: Boolean,
        default: false
    }
}, { timestamps: true, collection: 'location_pings' }); // createdAt handled automatically

module.exports = mongoose.model("LocationPing", LocationPingSchema);
