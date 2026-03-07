const nodemailer = require('nodemailer');

async function createTestAccount() {
    try {
        console.log("Creating Ethereal test account...");
        const account = await nodemailer.createTestAccount();

        console.log("\n✅ Ethereal Account Created!");
        console.log("---------------------------------------------------");
        console.log("Add these details to your .env file:");
        console.log("---------------------------------------------------");
        console.log(`EMAIL_SERVICE=smtp.ethereal.email`);
        console.log(`EMAIL_USER=${account.user}`);
        console.log(`EMAIL_PASSWORD=${account.pass}`);
        console.log(`SMTP_HOST=${account.smtp.host}`);
        console.log(`SMTP_PORT=${account.smtp.port}`);
        console.log("---------------------------------------------------");
        console.log("\nAfter updating .env, run: node scripts/test-daily-report.js");
    } catch (err) {
        console.error('Failed to create a test account. ' + err.message);
    }
}

createTestAccount();
