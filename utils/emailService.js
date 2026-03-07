const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendEmail = async (to, subject, html, cc = null) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    // Add CC if provided
    if (cc) {
      mailOptions.cc = cc;
    }

    console.log(`Attempting to send email to: ${to}`);
    if (cc) {
      console.log(`CC: ${cc}`);
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    // Preview only available when sending through an Ethereal account
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("Preview URL: %s", previewUrl);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message };
  }
};

// Daily attendance report template
const createDailyReportHTML = (data) => {
  const { date, totalUsers, presentCount, absentCount, attendanceList } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          padding: 30px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .header p {
          margin: 10px 0 0 0;
          opacity: 0.9;
        }
        .stats {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          flex: 1;
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }
        .stat-card h3 {
          margin: 0 0 10px 0;
          color: #64748b;
          font-size: 14px;
          text-transform: uppercase;
        }
        .stat-card .value {
          font-size: 32px;
          font-weight: bold;
          color: #1e293b;
        }
        .stat-card.success {
          border-left-color: #10b981;
        }
        .stat-card.danger {
          border-left-color: #ef4444;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th {
          background: #f1f5f9;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        tr:last-child td {
          border-bottom: none;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .badge-success {
          background: #dcfce7;
          color: #166534;
        }
        .badge-danger {
          background: #fee2e2;
          color: #991b1b;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Daily Attendance Report</h1>
          <p>${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div class="stats">
          <div class="stat-card">
            <h3>Total Users</h3>
            <div class="value">${totalUsers}</div>
          </div>
          <div class="stat-card success">
            <h3>Present</h3>
            <div class="value">${presentCount}</div>
          </div>
          <div class="stat-card danger">
            <h3>Absent</h3>
            <div class="value">${absentCount}</div>
          </div>
        </div>

        <h2 style="margin-bottom: 15px;">Attendance Details</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceList.map(record => `
              <tr>
                <td>${record.name}</td>
                <td>${record.email}</td>
                <td>${record.checkIn || '-'}</td>
                <td>${record.checkOut || '-'}</td>
                <td>${record.workingHours ? record.workingHours.toFixed(2) + ' hrs' : '-'}</td>
                <td>
                  <span class="badge badge-${record.status === 'Present' ? 'success' : 'danger'}">
                    ${record.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This is an automated report from the Attendance Management System</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  createDailyReportHTML
};
