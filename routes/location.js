const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { logLocation, getLiveLocations, getUserHistory } = require("../controllers/location");

// App: Post location background update
router.post("/log", auth, logLocation);

// Admin: Get live map data (Latest location of all users)
router.get("/live", auth, getLiveLocations);

// Admin: Get historical path of a specific user (Where they reached)
router.get("/history", auth, getUserHistory);

module.exports = router;
