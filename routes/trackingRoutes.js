const express = require('express');
const router = express.Router();

const { updateLocation, getLiveLocations, getUserHistory } = require('../controllers/trackingController');
const auth = require('../middleware/auth');

router.post('/update', auth, updateLocation);
router.get('/live', auth, getLiveLocations);
router.get('/history/:userId', auth, getUserHistory);

module.exports = router;
