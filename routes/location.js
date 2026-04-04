const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { logLocation, logLocationBatch, getLiveLocations, getUserHistory, updateLocationAddress } = require("../controllers/location");

// App: Post single location (Legacy)
router.post("/log", auth, logLocation);

// App: Post location batch (Industry Standard — every 30s)
router.post("/batch", auth, logLocationBatch);

// Admin: Get live map data
router.get("/live", auth, getLiveLocations);

// Admin: Get historical path
router.get("/history", auth, getUserHistory);

// Admin: Update location address
router.put("/address", auth, updateLocationAddress);

module.exports = router;
