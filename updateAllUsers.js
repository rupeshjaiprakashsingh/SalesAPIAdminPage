require('dotenv').config();
const connectDB = require('./db/connect');
const User = require('./models/User');

const updateAllUsers = async () => {
    try {
        await connectDB(process.env.MONGO_URI);
        console.log('Connected to DB');

        const users = await User.find({});
        console.log(`Found ${users.length} users to update.`);

        let successCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                // Extract first name for username
                // If name is "John Doe", firstName is "John"
                // If name is just "John", firstName is "John"
                // Convert to lowercase for consistency
                let baseUsername = user.name ? user.name.split(' ')[0].toLowerCase() : `user${user._id.toString().substring(0, 5)}`;

                // Ensure it's alphanumeric and at least 3 chars
                baseUsername = baseUsername.replace(/[^a-z0-9]/g, '');
                if (baseUsername.length < 3) {
                    baseUsername = baseUsername + "123";
                }

                let username = baseUsername;
                let counter = 1;

                // Since username must be unique, make sure we don't duplicate
                // We don't want to query DB inside the loop if we can avoid it, but for a one-off script it's fine.
                let useExistingUsername = false;
                if (user.username && user.username === username) {
                    useExistingUsername = true;
                }

                while (!useExistingUsername) {
                    const existing = await User.findOne({ username: username, _id: { $ne: user._id } });
                    if (existing) {
                        username = `${baseUsername}${counter}`;
                        counter++;
                    } else {
                        break;
                    }
                }

                // Update fields
                user.username = username;
                user.password = '123456';

                // Note: user.save() will trigger the pre-save hook which hashes the password.
                await user.save();
                console.log(`Updated user: ${user.name} -> username: ${user.username}`);
                successCount++;
            } catch (err) {
                console.error(`Error updating user ${user._id} (${user.name}):`, err.message);
                errorCount++;
            }
        }

        console.log(`\nUpdate Summary:`);
        console.log(`Successfully updated: ${successCount}`);
        console.log(`Failed to update: ${errorCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

updateAllUsers();
