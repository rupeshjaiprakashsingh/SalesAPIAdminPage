require('dotenv').config({ path: 'c:/Users/rupes/AndroidStudioProjects/SalesAPIAdminPage/.env' });
const mongoose = require('mongoose');
const locationController = require('./controllers/location');

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to Database.');

        const req = {
            user: { id: "65eaf964d90ceb7e61a6c11a" }, // use an existing user id or any valid objectId
            body: {
                latitude: 12.34,
                longitude: 56.78,
                accuracy: 10,
                batteryPercentage: 90
            }
        };

        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log(`[Status: ${this.statusCode}] Output:`, data);
            }
        };

        await locationController.logLocation(req, res);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

runTest();
