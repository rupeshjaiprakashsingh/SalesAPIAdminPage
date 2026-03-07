require("dotenv").config({ path: "./.env" });
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    }
};

const fixWorkingHours = async () => {
    await connectDB();

    try {
        console.log("Starting migration...");

        // Find all OUT records (we re-process all to update status logic)
        const outRecords = await Attendance.find({
            attendanceType: "OUT"
        });

        console.log(`Found ${outRecords.length} OUT records to process.`);

        let updatedCount = 0;

        for (const outRecord of outRecords) {
            const { userId, deviceTime } = outRecord;

            // Find matching IN record for the same day
            const startOfDay = new Date(deviceTime);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(deviceTime);
            endOfDay.setHours(23, 59, 59, 999);

            const inRecord = await Attendance.findOne({
                userId,
                attendanceType: "IN",
                createdAt: {
                    $gte: startOfDay,
                    $lte: endOfDay,
                },
            });

            if (inRecord) {
                const ms = new Date(deviceTime) - new Date(inRecord.deviceTime);
                const workingHours = ms / (1000 * 60 * 60); // Hours

                let status = "Present";
                if (workingHours > 6) {
                    status = "Full Day";
                } else if (workingHours > 3) {
                    status = "Half Day";
                }

                if (workingHours < 4) {
                    status = "Present";
                }

                outRecord.workingHours = workingHours;
                outRecord.status = status;
                await outRecord.save();
                updatedCount++;
                console.log(`Updated record ${outRecord._id}: ${workingHours.toFixed(2)} hrs, Status: ${status}`);
            } else {
                console.log(`No IN record found for OUT record ${outRecord._id}`);
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} records.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration error:", error);
        process.exit(1);
    }
};

fixWorkingHours();
