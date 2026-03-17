require('dotenv').config({ path: 'c:/Users/rupes/AndroidStudioProjects/SalesAPIAdminPage/.env' });
const mongoose = require('mongoose');
const User = require('./models/User');

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ _id: "697a2a8b9fa99beab19ceb28" }).select("lastLocation");
        console.log("lastLocation:", user ? user.lastLocation : "User not found");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};
runTest();
