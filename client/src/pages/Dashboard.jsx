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
  { to: "/dashboard/geo", label: "Geo Dashboard", icon: "ri-map-pin-user-line" },
  { to: "/dashboard/users", label: "Staff Management", icon: "ri-team-line" },
  { to: "/dashboard/customers", label: "Customers", icon: "ri-user-star-line" },
  { to: "/dashboard/live-tracking", label: "Live Tracking", icon: "ri-map-2-line" },
  { to: "/dashboard/timeline-report", label: "Timeline Report", icon: "ri-time-line" },
  { to: "/dashboard/calendar-report", label: "Calendar Report", icon: "ri-calendar-event-line" },
  { to: "/dashboard/settings", label: "System Settings", icon: "ri-settings-4-line" },
];

// Extra page titles not in nav items (sub-routes)
const EXTRA_PAGE_TITLES = [
  { to: "/dashboard/attendance/approval", label: "Attendance Approval" },
  { to: "/dashboard/attendance", label: "Mark Attendance" },
  { to: "/dashboard/attendance-list", label: "Attendance List" },
  { to: "/dashboard/users", label: "Staff Management" },
];

const Dashboard = () => {
  const [token] = useState(
    JSON.parse(localStorage.getItem("auth")) || ""
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("user");
  const [userName, setUserName] = useState("Staff");
  const [currentTime, setCurrentTime] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

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
      const response = await axios.get("/api/v1/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response && response.data) {
        setRole(response.data.role || "user");
        setUserName(response.data.name || response.data.username || "Staff");
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
    // Check extra titles first (more specific routes like /attendance/approval before /attendance)
    const extraMatch = EXTRA_PAGE_TITLES.find(item =>
      location.pathname === item.to || location.pathname.startsWith(item.to + "/")
    );
    if (extraMatch) return extraMatch.label;

    const allItems = [...NAV_ITEMS_COMMON, ...NAV_ITEMS_ADMIN];
    const found = allItems.find(item =>
      item.exact
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to) && item.to !== "/dashboard"
    );
    return found ? found.label : "Dashboard";
  };

  // Listen for pending count updates broadcast by HomeDashboard
  useEffect(() => {
    const handler = (e) => setPendingCount(e.detail?.count ?? 0);
    window.addEventListener("pendingApprovalsUpdate", handler);
    return () => window.removeEventListener("pendingApprovalsUpdate", handler);
  }, []);

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
            {NAV_ITEMS_COMMON.filter(item => !(role === "admin" && (item.label === "Mark Attendance" || item.label === "My Profile"))).map((item) => (
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
          <Link
            to="/dashboard/attendance/approval"
            className="topbar-icon-btn topbar-badge"
            title={pendingCount > 0 ? `${pendingCount} pending approvals` : "Notifications"}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <i className="ri-notification-3-line"></i>
            {pendingCount > 0 && (
              <span
                className="topbar-badge-dot"
                style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  background: '#ef4444', color: 'white',
                  borderRadius: '9999px', fontSize: '9px',
                  fontWeight: 700, minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', border: '2px solid white', lineHeight: 1
                }}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Link>
          <Link to="/dashboard/settings">
            <button className="topbar-icon-btn" title="Settings">
              <i className="ri-settings-4-line"></i>
            </button>
          </Link>
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
