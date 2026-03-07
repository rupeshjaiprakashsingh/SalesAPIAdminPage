require('dotenv').config();
const connectDB = require('./db/connect');
const User = require('./models/User');

const createAdmin = async () => {
    try {
        await connectDB(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Remove existing admin if any
        await User.deleteOne({ username: 'admin' });

        const admin = new User({
            name: 'System Admin',
            username: 'admin',
            email: 'admin@system.local',
            password: '123456',
            role: 'admin'
        });

        await admin.save();
        console.log('Admin user created successfully!');

        // Simulate Login Check
        console.log('Testing login for admin...');
        let foundUser = await User.findOne({ username: 'admin' });
        if (foundUser) {
            const isMatch = await foundUser.comparePassword('123456');
            if (isMatch) {
                console.log('Login check PASSED: Password verified successfully!');
            } else {
                console.log('Login check FAILED: Password mismatch.');
            }
        } else {
            console.log('Login check FAILED: User not found.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdmin();
