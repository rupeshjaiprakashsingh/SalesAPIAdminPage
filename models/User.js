const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide name'],
        minlength: 3,
        maxlength: 50
    },
    username: {
        type: String,
        required: [true, 'Please provide username'],
        unique: true,
        minlength: 3,
        maxlength: 50
    },
    email: {
        type: String,
        required: [true, "Please provide email"],
        minlength: 3,
        maxlength: 50,
        match: [
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            'Please provide a valid email',
        ],
        unique: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide password'],
        minlength: 6,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    mobileNumber: {
        type: String,
        required: [true, 'Please provide mobile number'],
    },
    dateOfBirth: {
        type: Date,
        required: [true, 'Please provide date of birth'],
    },
    deviceId: {
        type: String,
        default: null,
    },
    // New fields for live location & status
    lastLocation: {
        lat: { type: Number },
        lng: { type: Number },
        timestamp: { type: Date }
    },
    batteryStatus: {
        type: Number
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    employeeId: {
        type: String,
        default: ""
    },
    designation: {
        type: String,
        default: ""
    },
    additionalDetails: {
        type: Object,
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
}

module.exports = mongoose.model("User", UserSchema);