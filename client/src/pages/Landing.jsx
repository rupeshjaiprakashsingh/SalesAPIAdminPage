import React from 'react';
import { Link } from 'react-router-dom';
import useSEO from '../seo/useSEO';
import "../styles/Landing.css";

const Landing = () => {
  useSEO({
    title: "Sales Tracking & GPS Attendance Management for Field Teams",
    description:
      "SalesAdmin by ScanServices — The #1 field sales tracking and GPS attendance system for Indian businesses. Monitor your team live, automate attendance, and generate reports instantly. Start free today.",
    canonicalPath: "/",
  });

  return (
    <div className="landing-container">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <i className="ri-pulse-line"></i>
          </div>
          <div className="nav-logo-text">
            Sales<span>Admin</span>
          </div>
        </div>
        <div className="nav-buttons">
          <Link to="/login" className="btn-outline">
            Sign In
          </Link>
          <Link to="/register" className="btn btn-hero btn-hero-primary" style={{textDecoration:'none'}}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section" aria-label="SalesAdmin — Sales Tracking & GPS Attendance Management">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            Real-time Field Sales Tracking Platform
          </div>

          <h1 className="hero-title">
            GPS Attendance &amp; Sales 
            <span className="highlight">Team Tracking Software</span>
          </h1>

          <p className="hero-subtitle">
            Powerful GPS-tagged attendance, live location monitoring, and advanced reports
            — all in one platform built for Indian field sales teams.
            Trusted by <strong>500+ businesses</strong> across India.
          </p>

          <div className="hero-cta">
            <Link to="/register" className="btn-hero btn-hero-primary">
              <i className="ri-rocket-line"></i>
              Start Free Today
            </Link>
            <Link to="/login" className="btn-hero btn-hero-secondary" style={{border:'none'}}>
              <i className="ri-play-circle-line"></i>
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stats-bar-item">
          <div className="stats-bar-num">10<span>K+</span></div>
          <div className="stats-bar-label">Staff Tracked</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-num">99<span>.9%</span></div>
          <div className="stats-bar-label">Uptime</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-num">500<span>+</span></div>
          <div className="stats-bar-label">Companies</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-num">4.8<span>★</span></div>
          <div className="stats-bar-label">Avg Rating</div>
        </div>
      </div>

      {/* Features Section */}
      <section className="features-section" aria-labelledby="features-heading">
        <div className="section-header">
          <span className="section-eyebrow">Why SalesAdmin?</span>
          <h2 id="features-heading" className="section-title">
            Complete Field Sales Tracking &amp;<br />Attendance Management System
          </h2>
          <p className="section-subtitle">
            From GPS attendance to live staff tracking — every tool your managers need
            to run a productive, accountable field sales team.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <i className="ri-map-pin-time-line"></i>
            </div>
            <h3>Smart Attendance</h3>
            <p>GPS-tagged check-ins and check-outs ensure accurate, tamper-proof attendance records for your entire team.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <i className="ri-map-2-line"></i>
            </div>
            <h3>Live GPS Tracking</h3>
            <p>Monitor your sales staff in real-time on an interactive map. Know exactly where your team is at any moment.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <i className="ri-bar-chart-2-line"></i>
            </div>
            <h3>Advanced Reports</h3>
            <p>Generate detailed attendance and performance reports. Export data as PDF or Excel for payroll and compliance.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <i className="ri-team-line"></i>
            </div>
            <h3>User Management</h3>
            <p>Add, edit, and manage your entire sales team from one place. Role-based access keeps your data secure.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <i className="ri-calendar-event-line"></i>
            </div>
            <h3>Calendar View</h3>
            <p>Visualize attendance data on a monthly calendar for quick insights into present, absent, and leave days.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <i className="ri-notification-3-line"></i>
            </div>
            <h3>Real-Time Alerts</h3>
            <p>Instant notifications when staff check-in or check-out. Stay informed with desktop and in-app alerts.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <address style={{fontStyle:'normal'}}>
          <strong>ScanServices</strong> — Sales Tracking &amp; Attendance Management Software
        </address>
        <p>
          &copy; {new Date().getFullYear()}{" "}
          <span className="footer-brand">SalesAdmin by ScanServices</span>.
          {" "}GPS attendance, field sales tracking &amp; team management. All rights reserved.
        </p>
        <nav aria-label="Footer links" style={{marginTop:'0.5rem',fontSize:'0.8rem'}}>
          <Link to="/login" style={{color:'inherit',marginRight:'1rem'}}>Sign In</Link>
          <Link to="/register" style={{color:'inherit'}}>Get Started Free</Link>
        </nav>
      </footer>
    </div>
  );
};

export default Landing;