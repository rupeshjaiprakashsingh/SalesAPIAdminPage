const express = require("express");
const router = express.Router();

const { getSettings, updateSettings } = require("../controllers/settings");
const authMiddleware = require("../middleware/auth");

router.get("/:type", authMiddleware, getSettings);
router.put("/:type", authMiddleware, updateSettings);

module.exports = router;
