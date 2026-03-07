const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const attendanceController = require("../controllers/attendance");

router.post("/mark", auth, attendanceController.markAttendance);
router.get("/list", auth, attendanceController.getAllAttendance);

router.get("/day/:userId", auth, attendanceController.getDailyAttendance);

router.delete("/:id", auth, attendanceController.deleteAttendance);
router.post("/delete-multiple", auth, attendanceController.deleteMultipleAttendance);
router.put("/:id", auth, attendanceController.updateAttendance);


router.get("/live-locations", auth, attendanceController.getLiveLocations);

module.exports = router;
