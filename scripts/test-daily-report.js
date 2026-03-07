require("dotenv").config();
const connectDB = require("../db/connect");
const { generateAndSendDailyReport } = require("../utils/cronJobs");

const start = async () => {
    try {
        console.log("Connecting to DB...");
        await connectDB(process.env.MONGO_URI);
        console.log("Connected to DB.");

        console.log("Triggering Daily Report...");
        const result = await generateAndSendDailyReport();

        if (result.success) {
            console.log("✅ Report sent successfully!");
        } else {
            console.log("❌ Failed to send report:", result.error || result.message);
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

start();
