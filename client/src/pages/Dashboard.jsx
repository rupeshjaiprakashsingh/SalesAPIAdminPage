import React, { useEffect, useState } from "react";
import "../styles/Dashboard.css";
import { Link, useNavigate, Outlet, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

const NAV_ITEMS_COMMON = [
  { to: "/dashboard", label: "Dashboard", icon: "ri-dashboard-3-line", exact: true },
  { to: "/dashboard/attendance", label: "Mark Attendance", icon: "ri-map-pin-time-line" },
  { to: "/dashboard/attendance-list", label: "Attendance List", icon: "ri-list-check-3" },
  { to: "/dashboard/profile", label: "My Profile", icon: "ri-user-3-line" },
];

const NAV_ITEMS_ADMIN = [
  { to: "/dashboard/users", label: "Staff Management", icon: "ri-team-line" },
  { to: "/dashboard/live-tracking", label: "Live Tracking", icon: "ri-map-2-line" },
  { to: "/dashboard/timeline-report", label: "Timeline Report", icon: "ri-time-line" },
  { to: "/dashboard/calendar-report", label: "Calendar Report", icon: "ri-calendar-event-line" },
];

const Dashboard = () => {
  const [token] = useState(
    JSON.parse(localStorage.getItem("auth")) || ""
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("user");
  const [userName, setUserName] = useState("Staff");
  const [currentTime, setCurrentTime] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      await axios.get("/api/v1/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setRole(payload.role || "user");
          setUserName(payload.name || payload.username || "Staff");
        } catch (e) {
          console.error("Error decoding token", e);
        }
      }
    } catch (error) {
      toast.error(error.message);
      localStorage.removeItem("auth");
      navigate("/login");
    }
  };

  useEffect(() => {
    if (token === "") {
      navigate("/login");
      toast.warn("Please login first to access dashboard");
    } else {
      fetchDashboardData();
    }
  }, [token, navigate]);

  const isActive = (to, exact = false) => {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to) && to !== "/dashboard";
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const pageTitle = () => {
    const allItems = [...NAV_ITEMS_COMMON, ...NAV_ITEMS_ADMIN];
    const found = allItems.find(item =>
      item.exact
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to) && item.to !== "/dashboard"
    );
    return found ? found.label : "Dashboard";
  };

  return (
    <div className="dashboard-main">
      {/* SIDEBAR */}
      <aside className={`dashboard-sidebar ${menuOpen ? "open" : ""}`}>
        {/* Logo - icon only in collapsed mode */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <i className="ri-pulse-line"></i>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main</div>
          {/* Navigation - icons only with tooltips */}
          <ul>
            {NAV_ITEMS_COMMON.filter(item => !(role === "admin" && item.label === "Mark Attendance")).map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  data-tooltip={item.label}
                  className={`nav-item ${
                    item.exact
                      ? location.pathname === item.to ? "active" : ""
                      : location.pathname.startsWith(item.to) && item.to !== "/dashboard" ? "active" : ""
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <i className={item.icon}></i>
                </Link>
              </li>
            ))}
          </ul>

          {role === "admin" && (
            <>
              <div className="sidebar-section-label">Admin Tools</div>
              <ul>
                {NAV_ITEMS_ADMIN.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      data-tooltip={item.label}
                      className={`nav-item ${location.pathname.startsWith(item.to) ? "active" : ""}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className={item.icon}></i>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="sidebar-section-label">Account</div>
          <ul>
            <li>
              <Link
                to="/logout"
                data-tooltip="Sign Out"
                className="nav-item nav-logout"
                onClick={() => setMenuOpen(false)}
              >
                <i className="ri-logout-box-r-line"></i>
              </Link>
            </li>
          </ul>
        </nav>

        {/* User Card - avatar only with tooltip */}
        <div className="sidebar-footer">
          <div
            className="sidebar-user-card"
            data-tooltip={`${userName} · ${role}`}
          >
            <div className="sidebar-user-avatar">
              {userName?.charAt(0)?.toUpperCase() || "S"}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {menuOpen && (
        <div
          className="sidebar-overlay show"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle sidebar"
      >
        <i className={menuOpen ? "ri-close-line" : "ri-menu-2-line"}></i>
      </button>

      {/* TOP BAR */}
      <header className="dashboard-topbar">
        <div className="topbar-left">
          <span className="topbar-greeting">{greeting()}, {userName} 👋</span>
          <span className="topbar-title">{pageTitle()}</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-time">{currentTime}</div>
          <button className="topbar-icon-btn topbar-badge" title="Notifications">
            <i className="ri-notification-3-line"></i>
            <span className="topbar-badge-dot"></span>
          </button>
          <button className="topbar-icon-btn" title="Settings">
            <i className="ri-settings-4-line"></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Dashboard;
