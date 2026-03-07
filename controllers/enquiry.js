const Enquiry = require("../models/Enquiry");
const { sendEmail } = require("../utils/emailService");

const createEnquiry = async (req, res) => {
    const { fullName, email, mobileNumber, message } = req.body;

    if (!fullName || !email || !mobileNumber || !message) {
        return res.status(400).json({ msg: "Please provide all required fields" });
    }

    try {
        // Save to database
        const enquiry = await Enquiry.create({
            fullName,
            email,
            mobileNumber,
            message,
        });

        // Send confirmation email
        const emailSubject = "We received your enquiry!";
        const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Thank you for contacting us!</h2>
        <p>Hi ${fullName},</p>
        <p>We have received your enquiry and will get back to you shortly.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Your Details:</h3>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Mobile:</strong> ${mobileNumber}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">${message}</p>
        </div>
        <p>Best regards,<br>Attendance Management Team</p>
      </div>
    `;

        // CC list for enquiry notifications
        const ccEmails = [
            'info@scanservices.co.in',
            'INFO@scanservices.in',
            'rupeshsingh7208@gmail.com'
        ].join(', ');

        await sendEmail(email, emailSubject, emailHtml, ccEmails);

        res.status(201).json({ success: true, msg: "Enquiry submitted successfully", enquiry });
    } catch (error) {
        console.error("Enquiry submission error:", error);
        res.status(500).json({ msg: "Failed to submit enquiry" });
    }
};

const getAllEnquiries = async (req, res) => {
    try {
        const enquiries = await Enquiry.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: enquiries.length, data: enquiries });
    } catch (error) {
        console.error("Fetch enquiries error:", error);
        res.status(500).json({ msg: "Failed to fetch enquiries" });
    }
};

module.exports = {
    createEnquiry,
    getAllEnquiries
};
