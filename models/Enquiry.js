const mongoose = require("mongoose");

const EnquirySchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, "Please provide full name"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Please provide email address"],
        match: [
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            "Please provide a valid email",
        ],
    },
    mobileNumber: {
        type: String,
        required: [true, "Please provide mobile number"],
    },
    message: {
        type: String,
        required: [true, "Please provide message"],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Enquiry", EnquirySchema);
