import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/StaffProfile.css";

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const token =
    JSON.parse(localStorage.getItem("auth")) || 
    localStorage.getItem("token") || 
    "";

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`/api/v1/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res.data.user || res.data); // Adjust according to API response structure
      } catch (err) {
        console.error(err);
        toast.error("Failed to load user profile");
      }
      setLoading(false);
    };
    if (id) fetchUser();
  }, [id, token]);

  if (loading) return <div style={{padding: '40px'}}>Loading Profile Data...</div>;
  if (!user) return <div style={{padding: '40px'}}>User Not Found</div>;

  return (
    <div className="staff-profile-page">
      <div className="staff-profile-top">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <i className="ri-arrow-left-line"></i> Back
        </button>

        <div className="staff-header-card">
          <div className="header-left">
            <div className="header-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
            <div>
              <div className="header-name">{user.name?.toUpperCase()}</div>
              <div className="header-sub">
                ID {user.employeeId || "-"} | {user.role === "admin" ? "ADMIN" : "REGULAR (Monthly Regular)"}
              </div>
            </div>
          </div>
          <div>
            <button className="header-actions-btn">
              Actions <i className="ri-arrow-down-s-line"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="staff-profile-layout">
        {/* Sidebar Navigation */}
        <div className="staff-sidebar">
          <ul className="staff-nav-list">
            <li className="staff-nav-item active">Profile</li>
            <li className="staff-nav-item" onClick={() => navigate(`/dashboard/attendance/${user._id}`)}>Attendance</li>
            <li className="staff-nav-item">Salary Overview</li>
            <li className="staff-nav-item">YTD Statement</li>
            <li className="staff-nav-item">Salary Structure</li>
            <li className="staff-nav-item">Loans</li>
            <li className="staff-nav-item">Leave(s)</li>
            <li className="staff-nav-item">Document Centre</li>
          </ul>
        </div>

        {/* Content Area */}
        <div className="staff-content">
          <h3 className="content-title">Profile</h3>

          {/* Profile Information */}
          <div className="info-section">
            <div className="section-header">
              <div className="section-title">Profile Information</div>
              <button className="edit-btn">
                <i className="ri-pencil-line"></i> Edit
              </button>
            </div>
            <div className="info-grid">
              <div className="info-col">
                <span className="info-label">Name <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">{user.name?.toUpperCase()}</span>
              </div>
              <div className="info-col">
                <span className="info-label">ID <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">{user.employeeId || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Designation</span>
                <span className="info-value">SALES EXECUTIVE</span>
              </div>
              <div className="info-col">
                <span className="info-label">Staff Type</span>
                <span className="info-value">Regular</span>
              </div>
              <div className="info-col">
                <span className="info-label">Contact Number <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">{user.mobileNumber || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Attendance Supervisor</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Reporting Manager</span>
                <span className="info-value">Admin</span>
              </div>
            </div>
          </div>

          {/* General Information */}
          <div className="info-section">
            <div className="section-header">
              <div className="section-title">General Information</div>
              <button className="edit-btn">
                <i className="ri-pencil-line"></i> Edit
              </button>
            </div>
            <div className="info-grid">
              <div className="info-col">
                <span className="info-label">Salary Cycle</span>
                <span className="info-value">1</span>
              </div>
              <div className="info-col">
                <span className="info-label">Weekly-off Template</span>
                <span className="info-value">Sunday WO</span>
              </div>
              <div className="info-col">
                <span className="info-label">Holiday Template</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Leave Template</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Shift</span>
                <span className="info-value">Regular</span>
              </div>
              <div className="info-col">
                <span className="info-label">Attendance on Weekly Off Template</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Geofence Template</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Attendance Settings Templates</span>
                <span className="info-value">Template 2</span>
              </div>
              <div className="info-col">
                <span className="info-label">Reimbursement Template</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Salary Access</span>
                <span className="info-value">Disabled</span>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="info-section">
            <div className="section-header">
              <div className="section-title">Personal Information</div>
              <button className="edit-btn">
                <i className="ri-pencil-line"></i> Edit
              </button>
            </div>
            <div className="info-grid">
              <div className="info-col">
                <span className="info-label">Email</span>
                <span className="info-value">{user.email || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Gender <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">MALE</span>
              </div>
              <div className="info-col">
                <span className="info-label">Date of Birth <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">{user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("en-GB", {day: '2-digit', month: 'short', year: 'numeric'}) : "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Marital Status</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Blood Group</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Emergency Contact</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Father's Name</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-col">
                <span className="info-label">Mother's Name</span>
                <span className="info-value">-</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
