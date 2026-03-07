import React from 'react';
import { Link } from 'react-router-dom';
import "../styles/Landing.css";
import { FaBuilding, FaShoppingCart, FaEnvelope, FaLaptopCode } from "react-icons/fa";

const Landing = () => {
  return (
    <div className="landing-container">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <span>Attendance App</span>
        </div>
        <div className="nav-buttons">
          <Link to="/login" className="btn btn-outline">
            Login
          </Link>
          <Link to="/register" className="btn btn-primary">
            Register
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Streamline Your Workforce Management
          </h1>
          <p className="hero-subtitle">
            A comprehensive solution for attendance tracking, reporting, and employee management.
            Simple, efficient, and secure.
          </p>
          <Link to="/register" className="btn btn-primary" style={{ fontSize: '18px', padding: '14px 32px' }}>
            Get Started Now
          </Link>
        </div>
      </header>

      {/* Services Section */}
      <section className="services-section">
        <h2 className="section-title">Our Services</h2>
        <p className="section-subtitle">Comprehensive software solutions for your business needs</p>

        <div className="services-grid">
          {/* Service 1 */}
          <div className="service-card">
            <div className="service-icon">
              <FaBuilding />
            </div>
            <h3>Enterprise Software</h3>
            <p>
              Scalable and robust software solutions designed to meet the complex needs of large organizations.
              Streamline operations and boost productivity.
            </p>
          </div>

          {/* Service 2 */}
          <div className="service-card">
            <div className="service-icon">
              <FaShoppingCart />
            </div>
            <h3>E-commerce Solutions</h3>
            <p>
              End-to-end e-commerce platforms that drive sales. From inventory management to
              secure payment gateways and user-friendly storefronts.
            </p>
          </div>

          {/* Service 3 */}
          <div className="service-card">
            <div className="service-icon">
              <FaEnvelope />
            </div>
            <h3>Email Services</h3>
            <p>
              Reliable and secure business email hosting, marketing automation, and
              transactional email services to keep you connected.
            </p>
          </div>

          {/* Service 4 */}
          <div className="service-card">
            <div className="service-icon">
              <FaLaptopCode />
            </div>
            <h3>All IT Services</h3>
            <p>
              From custom web development to cloud infrastructure and technical support.
              We provide a full spectrum of IT services to grow your business.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Attendance App. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;