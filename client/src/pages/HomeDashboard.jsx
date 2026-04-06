import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../styles/HomeDashboard.css";
import MusterRoll from "./MusterRoll";
import DailyAttendanceView from "./DailyAttendanceView";

export default function HomeDashboard() {
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Staff");
  const [loading, setLoading] = useState(true);

  // Admin stats
  const [adminStats, setAdminStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // User stats
  const [userStats, setUserStats] = useState(null);

  const navigate = useNavigate();
  const token =
    JSON.parse(localStorage.getItem("auth")) ||
    localStorage.getItem("token") ||
    "";

  useEffect(() => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUserRole(payload.role || "user");
      setUserId(payload.id);
      setUserName(payload.name || payload.username || "Staff");
    } catch (err) {
      console.error("Token parse error:", err);
      setUserRole("user");
    }
  }, [token]);

  useEffect(() => {
    if (userRole) fetchDashboardData();
  }, [userRole, userId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (userRole === "admin") {
        const [statsRes, trendRes, activityRes] = await Promise.all([
          axios.get("/api/v1/dashboard/admin-stats", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/v1/dashboard/attendance-trend?days=7", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/v1/dashboard/recent-activity?limit=10", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setAdminStats(statsRes.data.stats);
        setTrend(trendRes.data.trend);
        const activities = activityRes.data.activities;
        setRecentActivity(activities);
        if (activities.length > 0) {
          lastKnownActivityId.current = activities[0]._id;
        }
      } else {
        const statsRes = await axios.get(
          `/api/v1/dashboard/user-stats/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
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
  const audioRef = React.useRef(
    new Audio(
      "https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"
    )
  );

  useEffect(() => {
    if (userRole !== "admin") return;

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const checkForNewActivity = async () => {
      try {
        const res = await axios.get(
          "/api/v1/dashboard/recent-activity?limit=5",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const latestActivities = res.data.activities;

        if (latestActivities.length > 0) {
          const newest = latestActivities[0];
          if (
            lastKnownActivityId.current &&
            newest._id !== lastKnownActivityId.current
          ) {
            const activityName = newest.userId?.name || "Someone";
            const type = newest.attendanceType;

            audioRef.current
              .play()
              .catch((e) => console.log("Audio play failed", e));

            if (Notification.permission === "granted") {
              new Notification("New Attendance Activity", {
                body: `${activityName} marked ${type}`,
                icon: "/vite.svg",
              });
            }
            setRecentActivity(latestActivities);
          }
          lastKnownActivityId.current = newest._id;
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    const interval = setInterval(checkForNewActivity, 5000);
    return () => clearInterval(interval);
  }, [userRole, token]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <span>Loading dashboard...</span>
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
          userName={userName}
          token={token}
        />
      ) : (
        <UserDashboard
          stats={userStats}
          navigate={navigate}
          userName={userName}
        />
      )}
    </div>
  );
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
function AdminDashboard({ stats: initialStats, trend, recentActivity, navigate, userName, token }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [displayStats, setDisplayStats] = useState(initialStats);

  // Keep displayStats in sync if initialStats updates (on mount/reload)
  useEffect(() => {
    setDisplayStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    const fetchSpecificDate = async () => {
      try {
        const res = await axios.get(`/api/v1/dashboard/admin-stats?date=${selectedDate}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDisplayStats(res.data.stats);
      } catch (err) {
        console.error("Failed to fetch specific date stats", err);
      }
    };

    if (selectedDate !== new Date().toISOString().split("T")[0]) {
      fetchSpecificDate();
    } else {
      setDisplayStats(initialStats);
    }
  }, [selectedDate, token, initialStats]);

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const today = new Date();
  const day = today.getDate();
  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    year: "numeric",
  });

  const formattedSelectedDate = new Date(selectedDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const s = displayStats || {};

  return (
    <>
      {/* Welcome Banner */}
      <div className="dashboard-welcome">
        <div className="welcome-content">
          <div className="welcome-text">
            <h1>Welcome back, {userName} 🚀</h1>
            <p>Here's what's happening with your team today.</p>
          </div>
          <div className="welcome-date">
            <div className="welcome-date-day">{day}</div>
            <div className="welcome-date-info">{dateStr.replace(/^\w+, /, "")}</div>
          </div>
        </div>
      </div>

      {/* Attendance Metrics */}
      <div className="attendance-metrics-section">
        <h3>Attendance Metrics</h3>
        <div className="am-card">
          <div className="am-header">
            <div className="am-title">
              <div className="am-icon-bg">
                <i className="ri-group-line"></i>
              </div>
              <span>Attendance</span>
            </div>
            
            <div className="am-controls">
              {s.pendingApprovals > 0 && (
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', background: '#fff1f2', 
                  padding: '6px 12px', borderRadius: '30px', border: '1px solid #fecaca',
                  marginRight: '12px'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>Total Pending for Approval: {s.pendingApprovals}</span>
                  <button 
                    onClick={() => navigate('/dashboard/attendance/approval')}
                    style={{ 
                      background: '#2563eb', color: 'white', border: 'none', padding: '4px 14px', 
                      borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                    }}
                  >
                    Review
                  </button>
                </div>
              )}
              <div className="am-date-picker">
                <i className="ri-arrow-left-s-line" onClick={() => changeDate(-1)}></i>
                <span>{formattedSelectedDate}</span>
                <i className="ri-arrow-right-s-line" onClick={() => changeDate(1)}></i>
                <i className="ri-calendar-line" style={{ marginLeft: "0.5rem" }}></i>
              </div>
              <i className="ri-settings-3-line am-settings-icon"></i>
            </div>
          </div>

          <div className="am-grid">
            <div className="am-item">
              <div className="am-label">Present <i className="ri-information-line"></i></div>
              <div className="am-value">{s.present || 0}{s.pendingApprovals > 0 && <span style={{ color: '#2563eb', fontSize: '0.8rem', marginLeft: '4px' }}>(+{s.pendingApprovals})</span>}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Absent <i className="ri-information-line"></i></div>
              <div className="am-value">{s.absent || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Half Day <i className="ri-information-line"></i></div>
              <div className="am-value">{s.halfDay || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Punched In <i className="ri-information-line"></i></div>
              <div className="am-value">{s.punchedIn || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Punched Out <i className="ri-information-line"></i></div>
              <div className="am-value">{s.punchedOut || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Not Marked <i className="ri-information-line"></i></div>
              <div className="am-value">{s.notMarked || 0}</div>
            </div>

            <div className="am-item">
              <div className="am-label">On Leave</div>
              <div className="am-value">{s.onLeave || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Upcoming Leaves <i className="ri-information-line"></i></div>
              <div className="am-value">{s.upcomingLeaves || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Overtime Hours</div>
              <div className="am-value">{s.overtimeHours || "0h 0m"}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Fine hours</div>
              <div className="am-value">{s.fineHours || "0h 0m"}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Deactivated</div>
              <div className="am-value">{s.deactivated || 0}</div>
            </div>
            <div className="am-item">
              <div className="am-label">Daily Work Entries</div>
              <div className="am-value">{s.dailyWorkEntries || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Attendance View List */}
      <DailyAttendanceView />

      {/* Charts & Activity */}
      <div className="dashboard-grid">
        {/* Attendance Trend Chart */}
        <div className="card">
          <div className="card-header">
            <h3><i className="ri-bar-chart-2-line" style={{marginRight: '0.5rem', color: 'var(--brand-primary)'}}></i>Attendance Trend</h3>
            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600}}>Last 7 Days</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              {trend && trend.length > 0 ? (
                <SimpleBarChart data={trend} />
              ) : (
                <div className="no-data">
                  <i className="ri-bar-chart-line"></i>
                  No trend data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3><i className="ri-activity-line" style={{marginRight: '0.5rem', color: 'var(--brand-primary)'}}></i>Recent Activity</h3>
            <span className="badge badge-primary">{recentActivity.length} events</span>
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
                      <p className="activity-name">
                        {activity.userId?.name || "Unknown"}
                      </p>
                      <p className="activity-action">
                        Marked{" "}
                        <span
                          className={`badge badge-${
                            activity.attendanceType === "IN"
                              ? "success"
                              : "danger"
                          }`}
                        >
                          {activity.attendanceType === "IN" ? (
                            <><i className="ri-login-box-line"></i> Check-In</>
                          ) : (
                            <><i className="ri-logout-box-line"></i> Check-Out</>
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="activity-time">
                      {new Date(activity.deviceTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">
                  <i className="ri-inbox-line"></i>
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{marginTop: '0'}}>
        <div className="card-header">
          <h3><i className="ri-dashboard-line" style={{marginRight:'0.5rem', color:'var(--brand-primary)'}}></i>Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="quick-actions">
            <div className="quick-action-card" onClick={() => navigate("/dashboard/users")}>
              <div className="quick-action-icon"><i className="ri-team-line"></i></div>
              <div className="quick-action-text">
                <span className="quick-action-label">Manage Staff</span>
                <span className="quick-action-desc">Add, edit, or remove staff</span>
              </div>
            </div>
            <div className="quick-action-card" onClick={() => navigate("/dashboard/attendance-list")}>
              <div className="quick-action-icon"><i className="ri-list-check-3"></i></div>
              <div className="quick-action-text">
                <span className="quick-action-label">All Attendance</span>
                <span className="quick-action-desc">View complete records</span>
              </div>
            </div>
            <div className="quick-action-card" onClick={() => navigate("/dashboard/live-tracking")}>
              <div className="quick-action-icon"><i className="ri-map-pin-line"></i></div>
              <div className="quick-action-text">
                <span className="quick-action-label">Live Tracking</span>
                <span className="quick-action-desc">Real-time staff locations</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Muster Roll */}
      <div className="card" style={{marginTop: '1.5rem', padding: '1rem 0', minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
        <MusterRoll />
      </div>
    </>
  );
}

// ─── User Dashboard ───────────────────────────────────────────────────────────
function UserDashboard({ stats, navigate, userName }) {
  const today = new Date();
  const day = today.getDate();
  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Welcome Banner */}
      <div className="dashboard-welcome">
        <div className="welcome-content">
          <div className="welcome-text">
            <h1>Hello, {userName} 👋</h1>
            <p>Track your attendance and stay on top of your schedule.</p>
          </div>
          <div className="welcome-date">
            <div className="welcome-date-day">{day}</div>
            <div className="welcome-date-info">{dateStr.replace(/^\w+, /, "")}</div>
          </div>
        </div>
      </div>

      {/* Today's Status */}
      <div className="today-status">
        <div className="card">
          <div className="card-header">
            <h3><i className="ri-sun-line" style={{marginRight:'0.5rem', color:'var(--warning)'}}></i>Today's Status</h3>
            <span className="badge badge-primary">{today.toLocaleDateString("en-IN", {weekday:"long"})}</span>
          </div>
          <div className="card-body">
            <div className="status-grid">
              <div className="status-item">
                <div className={`status-indicator ${stats?.todayStatus?.checkedIn ? "active" : "inactive"}`}>
                  <i className={stats?.todayStatus?.checkedIn ? "ri-login-box-line" : "ri-close-circle-line"}></i>
                </div>
                <p>Check-In</p>
              </div>
              <div className="status-item">
                <div className={`status-indicator ${stats?.todayStatus?.checkedOut ? "active" : "inactive"}`}>
                  <i className={stats?.todayStatus?.checkedOut ? "ri-logout-box-line" : "ri-close-circle-line"}></i>
                </div>
                <p>Check-Out</p>
              </div>
              <div className="status-item">
                <div className="status-value">
                  {stats?.todayStatus?.workingHours?.toFixed(1) || "0.0"}
                </div>
                <p>Hours Today</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon"><i className="ri-calendar-check-line"></i></div>
          <div className="stat-details">
            <h3>{stats?.thisMonth?.daysPresent || 0}</h3>
            <p>Days Present</p>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon"><i className="ri-time-line"></i></div>
          <div className="stat-details">
            <h3>{stats?.thisMonth?.totalWorkingHours || 0} <small style={{fontSize:'1rem'}}>hrs</small></h3>
            <p>Total Hours</p>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon"><i className="ri-bar-chart-line"></i></div>
          <div className="stat-details">
            <h3>{stats?.thisMonth?.averageHoursPerDay || 0} <small style={{fontSize:'1rem'}}>hrs</small></h3>
            <p>Avg Hours / Day</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3><i className="ri-flashlight-line" style={{marginRight:'0.5rem', color:'var(--warning)'}}></i>Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="quick-actions">
            <div className="quick-action-card" onClick={() => navigate("/dashboard/attendance")}>
              <div className="quick-action-icon" style={{background:'var(--success-light)', color:'var(--success)'}}>
                <i className="ri-map-pin-time-line"></i>
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">Mark Attendance</span>
                <span className="quick-action-desc">Check in or check out</span>
              </div>
            </div>
            <div className="quick-action-card" onClick={() => navigate("/dashboard/attendance-list")}>
              <div className="quick-action-icon">
                <i className="ri-list-check-3"></i>
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">My Attendance</span>
                <span className="quick-action-desc">View your history</span>
              </div>
            </div>
            <div className="quick-action-card" onClick={() => navigate("/dashboard/profile")}>
              <div className="quick-action-icon" style={{background:'var(--warning-light)', color:'var(--warning-hover)'}}>
                <i className="ri-user-3-line"></i>
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">My Profile</span>
                <span className="quick-action-desc">Update your information</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Simple Bar Chart ─────────────────────────────────────────────────────────
function SimpleBarChart({ data }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="simple-bar-chart">
      {data.map((item, index) => (
        <div key={index} className="bar-item">
          <div className="bar-container">
            <div
              className="bar"
              style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: '4px' }}
              title={`${item.count} attendees`}
            ></div>
          </div>
          <div className="bar-label">
            {new Date(item.date).toLocaleDateString("en-US", {
              weekday: "short",
            })}
          </div>
          <div className="bar-count">{item.count}</div>
        </div>
      ))}
    </div>
  );
}
