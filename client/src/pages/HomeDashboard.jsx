import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../styles/HomeDashboard.css";

export default function HomeDashboard() {
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  // Admin stats
  const [adminStats, setAdminStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // User stats
  const [userStats, setUserStats] = useState(null);

  const navigate = useNavigate();
  const token = JSON.parse(localStorage.getItem("auth")) || localStorage.getItem("token") || "";

  useEffect(() => {
    // Get user role from token
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUserRole(payload.role || "user");
      setUserId(payload.id);
    } catch (err) {
      console.error("Token parse error:", err);
      setUserRole("user");
    }
  }, [token]);

  useEffect(() => {
    if (userRole) {
      fetchDashboardData();
    }
  }, [userRole, userId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (userRole === "admin") {
        // Fetch admin stats
        const [statsRes, trendRes, activityRes] = await Promise.all([
          axios.get("/api/v1/dashboard/admin-stats", {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get("/api/v1/dashboard/attendance-trend?days=7", {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get("/api/v1/dashboard/recent-activity?limit=10", {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setAdminStats(statsRes.data.stats);
        setTrend(trendRes.data.trend);

        const activities = activityRes.data.activities;
        setRecentActivity(activities);
        if (activities.length > 0) {
          lastKnownActivityId.current = activities[0]._id;
        }
      } else {
        // Fetch user stats
        const statsRes = await axios.get(`/api/v1/dashboard/user-stats/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserStats(statsRes.data.stats);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error("Failed to load dashboard data");
    }
    setLoading(false);
  };

  // Notification Logic
  const lastKnownActivityId = React.useRef(null);
  const audioRef = React.useRef(new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"));

  useEffect(() => {
    if (userRole !== "admin") return;

    // Request permission
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const checkForNewActivity = async () => {
      try {
        const res = await axios.get("/api/v1/dashboard/recent-activity?limit=5", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const latestActivities = res.data.activities;

        if (latestActivities.length > 0) {
          const newest = latestActivities[0];

          // If we have a last known ID, and the newest ID is different -> New Activity!
          if (lastKnownActivityId.current && newest._id !== lastKnownActivityId.current) {
            // Find all new activities (simplified: just the top one or iterate)
            // For simplicity, we'll notify about the top one, or logic to find all newer could be added
            // But usually just notifying the newest is sufficient for polling

            const activityName = newest.userId?.name || "Someone";
            const type = newest.attendanceType;

            // Play Sound
            audioRef.current.play().catch(e => console.log("Audio play failed", e));

            // Show Desktop Notification
            if (Notification.permission === "granted") {
              new Notification("New Attendance Activity", {
                body: `${activityName} marked ${type}`,
                icon: "/vite.svg" // fallback icon
              });
            }

            // Update list in UI
            setRecentActivity(latestActivities);
          }

          // Update ref
          lastKnownActivityId.current = newest._id;
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    const interval = setInterval(checkForNewActivity, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [userRole, token]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="home-dashboard">
      {userRole === "admin" ? (
        <AdminDashboard
          stats={adminStats}
          trend={trend}
          recentActivity={recentActivity}
          navigate={navigate}
        />
      ) : (
        <UserDashboard
          stats={userStats}
          navigate={navigate}
        />
      )}
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard({ stats, trend, recentActivity, navigate }) {
  return (
    <>
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Real-time insights and analytics</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">👥</div>
          <div className="stat-details">
            <h3>{stats?.totalUsers || 0}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon">✓</div>
          <div className="stat-details">
            <h3>{stats?.presentToday || 0}</h3>
            <p>Present Today</p>
          </div>
        </div>

        <div className="stat-card stat-danger">
          <div className="stat-icon">✗</div>
          <div className="stat-details">
            <h3>{stats?.absentToday || 0}</h3>
            <p>Absent Today</p>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">⏱</div>
          <div className="stat-details">
            <h3>{stats?.averageWorkingHours || 0} hrs</h3>
            <p>Avg Working Hours</p>
          </div>
        </div>
      </div>

      {/* Charts and Activity */}
      <div className="dashboard-grid">
        {/* Attendance Trend */}
        <div className="card">
          <div className="card-header">
            <h3>Attendance Trend (Last 7 Days)</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              {trend && trend.length > 0 ? (
                <SimpleBarChart data={trend} />
              ) : (
                <p className="no-data">No trend data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-avatar">
                      {activity.userId?.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="activity-details">
                      <p className="activity-name">{activity.userId?.name || "Unknown"}</p>
                      <p className="activity-action">
                        Marked <span className={`badge badge-${activity.attendanceType === "IN" ? "success" : "danger"}`}>
                          {activity.attendanceType}
                        </span>
                      </p>
                    </div>
                    <div className="activity-time">
                      {new Date(activity.deviceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => navigate("/dashboard/users")}>
          Manage Users
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard/attendance-list")}>
          View All Attendance
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard/reports")}>
          Generate Reports
        </button>
      </div>
    </>
  );
}

// User Dashboard Component
function UserDashboard({ stats, navigate }) {
  return (
    <>
      <div className="dashboard-header">
        <h1>My Dashboard</h1>
        <p>Your attendance overview</p>
      </div>

      {/* Today's Status */}
      <div className="today-status">
        <div className="card">
          <div className="card-header">
            <h3>Today's Status</h3>
          </div>
          <div className="card-body">
            <div className="status-grid">
              <div className="status-item">
                <div className={`status-indicator ${stats?.todayStatus?.checkedIn ? "active" : "inactive"}`}>
                  {stats?.todayStatus?.checkedIn ? "✓" : "○"}
                </div>
                <p>Checked In</p>
              </div>
              <div className="status-item">
                <div className={`status-indicator ${stats?.todayStatus?.checkedOut ? "active" : "inactive"}`}>
                  {stats?.todayStatus?.checkedOut ? "✓" : "○"}
                </div>
                <p>Checked Out</p>
              </div>
              <div className="status-item">
                <div className="status-value">{stats?.todayStatus?.workingHours?.toFixed(2) || 0} hrs</div>
                <p>Working Hours</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* This Month Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">📅</div>
          <div className="stat-details">
            <h3>{stats?.thisMonth?.daysPresent || 0}</h3>
            <p>Days Present</p>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon">⏱</div>
          <div className="stat-details">
            <h3>{stats?.thisMonth?.totalWorkingHours || 0} hrs</h3>
            <p>Total Hours</p>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">📊</div>
          <div className="stat-details">
            <h3>{stats?.thisMonth?.averageHoursPerDay || 0} hrs</h3>
            <p>Avg Hours/Day</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="btn btn-primary btn-lg" onClick={() => navigate("/dashboard/attendance")}>
          📍 Mark Attendance
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard/attendance-list")}>
          View My Attendance
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard/profile")}>
          My Profile
        </button>
      </div>
    </>
  );
}

// Simple Bar Chart Component
function SimpleBarChart({ data }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="simple-bar-chart">
      {data.map((item, index) => (
        <div key={index} className="bar-item">
          <div className="bar-container">
            <div
              className="bar"
              style={{ height: `${(item.count / maxCount) * 100}%` }}
              title={`${item.count} attendees`}
            ></div>
          </div>
          <div className="bar-label">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div className="bar-count">{item.count}</div>
        </div>
      ))}
    </div>
  );
}
