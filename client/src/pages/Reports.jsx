import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Reports.css";

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState(null);
  const [reportType, setReportType] = useState("monthly"); // "monthly" or "dateRange"
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");

  const token = JSON.parse(localStorage.getItem("auth")) || localStorage.getItem("token") || "";

  // Fetch Users
  React.useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      try {
        const res = await axios.get("/api/v1/users?limit=1000", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.users || []);
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };
    fetchUsers();
  }, [token]);


  // Helper to format hours
  const formatHours = (decimal) => {
    if (!decimal) return "-";
    let hrs = Math.floor(decimal);
    let mins = Math.round((decimal - hrs) * 60);
    if (mins === 60) {
      hrs += 1;
      mins = 0;
    }
    return `${hrs}:${mins.toString().padStart(2, '0')} hrs`;
  };

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Generate years array (last 5 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" }
  ];

  // Send Daily Report
  const handleSendDailyReport = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        "/api/v1/reports/daily-report",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Daily report sent successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send daily report");
    }
    setLoading(false);
  };

  // View Monthly Report
  const handleViewMonthlyReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `/api/v1/reports/monthly-report?year=${selectedYear}&month=${selectedMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReportData(res.data);
      toast.success("Report generated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate report");
    }
    setLoading(false);
  };

  // Download Excel
  const handleDownloadExcel = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `/api/v1/reports/export-excel?year=${selectedYear}&month=${selectedMonth}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob"
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendance_${selectedYear}_${selectedMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Excel file downloaded successfully");
    } catch (err) {
      toast.error("Failed to download Excel file");
    }
    setLoading(false);
  };

  // View Date Range Report
  const handleViewDateRangeReport = async () => {
    if (!fromDate || !toDate) {
      toast.error("Please select both from date and to date");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `/api/v1/reports/date-range-report?fromDate=${fromDate}&toDate=${toDate}&userId=${selectedUser}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReportData(res.data);
      toast.success("Date range report generated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate date range report");
    }
    setLoading(false);
  };

  // Download Date Range Excel
  const handleDownloadDateRangeExcel = async () => {
    if (!fromDate || !toDate) {
      toast.error("Please select both from date and to date");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `/api/v1/reports/export-date-range-excel?fromDate=${fromDate}&toDate=${toDate}&userId=${selectedUser}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob"
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendance_${fromDate}_to_${toDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Excel file downloaded successfully");
    } catch (err) {
      toast.error("Failed to download Excel file");
    }
    setLoading(false);
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Reports & Analytics</h1>
        <p>Generate and download attendance reports</p>
      </div>

      {/* Daily Report Section */}
      <div className="card">
        <div className="card-header">
          <h3>📧 Daily Email Report</h3>
        </div>
        <div className="card-body">
          <p className="card-description">
            Send today's attendance summary to all admin users via email.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleSendDailyReport}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Daily Report Now"}
          </button>
          <p className="help-text">
            💡 Daily reports are automatically sent every day at 6:00 PM
          </p>
        </div>
      </div>

      {/* Monthly Report Section */}
      <div className="card">
        <div className="card-header">
          <h3>📊 Monthly Attendance Report</h3>
        </div>
        <div className="card-body">
          <p className="card-description">
            Generate detailed monthly attendance reports with export options.
          </p>

          <div className="report-filters">
            <div className="form-group">
              <label className="form-label">Month</label>
              <select
                className="form-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Year</label>
              <select
                className="form-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="report-actions">
            <button
              className="btn btn-primary"
              onClick={handleViewMonthlyReport}
              disabled={loading}
            >
              {loading ? "Generating..." : "View Report"}
            </button>
            <button
              className="btn btn-success"
              onClick={handleDownloadExcel}
              disabled={loading}
            >
              📥 Download Excel
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Report Section */}
      <div className="card">
        <div className="card-header">
          <h3>📅 Date Range Attendance Report</h3>
        </div>
        <div className="card-body">
          <p className="card-description">
            Generate detailed attendance reports for a custom date range with date-wise breakdown.
          </p>
          <br />

          {/* User Selector */}
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label className="form-label">Select User for Detailed Report</label>
            <select
              className="form-select"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ width: '100%', maxWidth: '300px' }}
            >
              <option value="all">All Users (Summary)</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="report-filters">
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-select"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-select"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="report-actions">
            <button
              className="btn btn-primary"
              onClick={handleViewDateRangeReport}
              disabled={loading}
            >
              {loading ? "Generating..." : "View Report"}
            </button>
            <button
              className="btn btn-success"
              onClick={handleDownloadDateRangeExcel}
              disabled={loading}
            >
              📥 Download Excel
            </button>
          </div>
        </div>
      </div>

      {/* Report Data Display */}
      {reportData && (
        <div className="card">
          <div className="card-header">
            <h3>
              Report: {reportData.monthName
                ? `${reportData.monthName} ${reportData.year}`
                : `${new Date(reportData.fromDate).toLocaleDateString('en-US')} to ${new Date(reportData.toDate).toLocaleDateString('en-US')}`}
            </h3>
          </div>
          <div className="card-body">
            <div className="table-container">

              {/* CHECK IF SINGLE USER DETAIL VIEW */}
              {selectedUser !== "all" && reportData.data && reportData.data.length === 1 ? (
                <div>
                  <h4>Details for: {reportData.data[0].name}</h4>
                  <table className="table-responsive">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>In Time</th>
                        <th>Out Time</th>
                        <th>Working Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const user = reportData.data[0];
                        // Generate table rows from dailyRecords object keys, sorted
                        const dates = Object.keys(user.dailyRecords || {}).sort();

                        if (dates.length === 0) return <tr><td colSpan="5" className="text-center">No records found within this range.</td></tr>

                        return dates.map(dateStr => {
                          const record = user.dailyRecords[dateStr];
                          const hasData = record.checkIn || record.checkOut;
                          return (
                            <tr key={dateStr}>
                              <td>{dateStr}</td>
                              <td>
                                {hasData ? (
                                  <span className="badge badge-success">Present</span>
                                ) : (
                                  <span className="badge badge-danger">Absent</span>
                                )}
                              </td>
                              <td>{record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : "-"}</td>
                              <td>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : "-"}</td>
                              <td>{formatHours(record.workingHours)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* SUMMARY TABLE FOR ALL USERS (Or Monthly Report) */
                <table className="table-responsive">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Days Present</th>
                      <th>Days Absent</th>
                      <th>Total Hours</th>
                      <th>Avg Hours/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data.map((user, index) => (
                      <tr key={index}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className="badge badge-success">
                            {user.daysPresent}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-danger">
                            {user.daysAbsent}
                          </span>
                        </td>
                        <td>{user.totalWorkingHours.toFixed(2)} hrs</td>
                        <td>{user.averageWorkingHours.toFixed(2)} hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
