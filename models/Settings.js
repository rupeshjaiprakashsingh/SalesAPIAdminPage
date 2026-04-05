const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
    type: { type: String, required: true, unique: true }, // e.g., 'roles_designations'
    data: { type: Array, default: [] } // array of strings
});

module.exports = mongoose.model("Settings", SettingsSchema);
