require('dotenv').config();
const mongoose = require('mongoose');
const locationController = require('./controllers/location');
const attendanceController = require('./controllers/attendance');

const runTest = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to Database.');

        const resObject = () => {
            const res = {};
            res.status = function(code) {
                this.statusCode = code;
                return this;
            };
            res.json = function(data) {
                console.log(`[Status: ${this.statusCode}] Output:`);
                console.dir(data, { depth: null, colors: true });
            };
            return res;
        };

        console.log('\n======================================================');
        console.log('🧪 TESTING: GET /api/v1/location/live');
        console.log('======================================================');
        await locationController.getLiveLocations({}, resObject());

        console.log('\n======================================================');
        console.log('🧪 TESTING: GET /api/v1/attendance/live-locations');
        console.log('======================================================');
        await attendanceController.getLiveLocations({}, resObject());

        console.log('\n✅ Tests Completed successfully.');
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

runTest();
