const express = require("express");
const router = express.Router();
const { createEnquiry } = require("../controllers/enquiry");

// 2. Honeypot Middleware: Check if hidden field is filled
const checkHoneypot = (req, res, next) => {
    // If the hidden '_honey' field has a value, it's likely a bot
    if (req.body._honey) {
        // Silently reject: return success to fool the bot, but don't process
        return res.status(200).json({ success: true, msg: "Enquiry submitted successfully" });
    }
    next();
};

// Apply security middleware to the route
router.post("/submit", checkHoneypot, createEnquiry);

// Get all enquiries (Admin only)
const auth = require("../middleware/auth");
const { getAllEnquiries } = require("../controllers/enquiry");
router.get("/all", auth, getAllEnquiries);

module.exports = router;
