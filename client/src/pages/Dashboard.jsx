import React, { useEffect, useState } from "react";
import "../styles/Dashboard.css";
import { Link, useNavigate, Outlet } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

const Dashboard = () => {
  const [token, setToken] = useState(
    JSON.parse(localStorage.getItem("auth")) || ""
  );
  const [data, setData] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("user");

  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get("/api/v1/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setData({
        msg: response.data.msg,
        luckyNumber: response.data.secret,
      });

      // Decode role from token (simple base64 decode of payload)
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setRole(payload.role || "user");
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

  return (
    <div className="dashboard-main">
      {/* NAVIGATION */}
      <nav className="dashboard-nav">
        {/* LEFT side + hamburger */}
        <div className="nav-left">
          <div className="nav-logo">Attendance</div>

          {/* Mobile Toggle */}
          <button
            className="nav-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        </div>

        {/* MENU ITEMS */}
        <ul className={`nav-menu ${menuOpen ? "open" : ""}`}>
          <li>
            <Link
              to="/dashboard"
              className="nav-item"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
          </li>

          <li>
            <Link
              to="/dashboard/attendance"
              className="nav-item"
              onClick={() => setMenuOpen(false)}
            >
              Attendance
            </Link>
          </li>

          <li>
            <Link
              to="/dashboard/attendance-list"
              className="nav-item"
              onClick={() => setMenuOpen(false)}
            >
              {role === "admin" ? "Attendance List" : "My Attendance"}
            </Link>
          </li>

          {role === "admin" && (
            <>
              <li>
                <Link
                  to="/dashboard/reports"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Reports
                </Link>
              </li>

              <li>
                <Link
                  to="/dashboard/users"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Users
                </Link>
              </li>

              <li>
                <Link
                  to="/dashboard/enquiries"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Enquiries
                </Link>
              </li>

              <li>
                <Link
                  to="/dashboard/live-tracking"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Live Map
                </Link>
              </li>

              <li>
                <Link
                  to="/dashboard/timeline-report"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Timeline Report
                </Link>
              </li>

              <li>
                <Link
                  to="/dashboard/calendar-report"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Calendar Report
                </Link>
              </li>
            </>
          )}

          <li>
            <Link
              to="/dashboard/profile"
              className="nav-item"
              onClick={() => setMenuOpen(false)}
            >
              Profile
            </Link>
          </li>

          {/* Mobile Logout */}
          <li className="mobile-logout">
            <Link
              to="/logout"
              className="nav-item nav-logout"
              onClick={() => setMenuOpen(false)}
            >
              Logout
            </Link>
          </li>
        </ul>

        {/* Desktop Logout */}
        <Link to="/logout" className="nav-item nav-logout desktop-logout">
          Logout
        </Link>
      </nav>

      {/* Render nested children */}
      <div className="dashboard-content">
        <Outlet />
      </div>
    </div >
  );
};

export default Dashboard;
