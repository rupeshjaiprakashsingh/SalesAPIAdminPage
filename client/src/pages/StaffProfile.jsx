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
  const [designations, setDesignations] = useState([]);

  const token =
    JSON.parse(localStorage.getItem("auth")) || 
    localStorage.getItem("token") || 
    "";
    
  // --- EDIT MODAL STATE ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [formData, setFormData] = useState({});

  const defDetails = user?.additionalDetails || {};

  const handleEditClick = (section) => {
    setEditSection(section);
    if(section === 'profile') {
      setFormData({
        name: user.name || '',
        employeeId: user.employeeId || '',
        designation: user.designation || '',
        mobileNumber: user.mobileNumber || '',
        staffType: defDetails.staffType || 'Regular',
        attendanceSupervisor: defDetails.attendanceSupervisor || '-',
        reportingManager: defDetails.reportingManager || 'Admin',
      });
    } else if(section === 'general') {
      setFormData({
        salaryCycle: defDetails.salaryCycle || '1',
        weeklyOffTemplate: defDetails.weeklyOffTemplate || 'Sunday WO',
        holidayTemplate: defDetails.holidayTemplate || '-',
        leaveTemplate: defDetails.leaveTemplate || '-',
        shift: defDetails.shift || 'Regular',
        attendanceOnWoTemplate: defDetails.attendanceOnWoTemplate || '-',
        geofenceTemplate: defDetails.geofenceTemplate || '-',
        attendanceSettings: defDetails.attendanceSettings || 'Template 2',
        reimbursementTemplate: defDetails.reimbursementTemplate || '-',
        salaryAccess: defDetails.salaryAccess || 'Disabled',
      });
    } else if(section === 'personal') {
      let d = '';
      if(user.dateOfBirth) {
         d = new Date(user.dateOfBirth).toISOString().split('T')[0];
      }
      setFormData({
        email: user.email || '',
        gender: defDetails.gender || 'MALE',
        dateOfBirth: d,
        maritalStatus: defDetails.maritalStatus || '-',
        bloodGroup: defDetails.bloodGroup || '-',
        emergencyContact: defDetails.emergencyContact || '-',
        fathersName: defDetails.fathersName || '-',
        mothersName: defDetails.mothersName || '-',
      });
    }
    setShowEditModal(true);
  };

  const handleFormChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = { additionalDetails: {...defDetails} };
      
      if(editSection === 'profile') {
         payload.name = formData.name;
         payload.employeeId = formData.employeeId;
         payload.designation = formData.designation;
         payload.mobileNumber = formData.mobileNumber;
         payload.additionalDetails.staffType = formData.staffType;
         payload.additionalDetails.attendanceSupervisor = formData.attendanceSupervisor;
         payload.additionalDetails.reportingManager = formData.reportingManager;
      } else if(editSection === 'general') {
         payload.additionalDetails.salaryCycle = formData.salaryCycle;
         payload.additionalDetails.weeklyOffTemplate = formData.weeklyOffTemplate;
         payload.additionalDetails.holidayTemplate = formData.holidayTemplate;
         payload.additionalDetails.leaveTemplate = formData.leaveTemplate;
         payload.additionalDetails.shift = formData.shift;
         payload.additionalDetails.attendanceOnWoTemplate = formData.attendanceOnWoTemplate;
         payload.additionalDetails.geofenceTemplate = formData.geofenceTemplate;
         payload.additionalDetails.attendanceSettings = formData.attendanceSettings;
         payload.additionalDetails.reimbursementTemplate = formData.reimbursementTemplate;
         payload.additionalDetails.salaryAccess = formData.salaryAccess;
      } else if(editSection === 'personal') {
         payload.email = formData.email;
         payload.dateOfBirth = formData.dateOfBirth;
         payload.additionalDetails.gender = formData.gender;
         payload.additionalDetails.maritalStatus = formData.maritalStatus;
         payload.additionalDetails.bloodGroup = formData.bloodGroup;
         payload.additionalDetails.emergencyContact = formData.emergencyContact;
         payload.additionalDetails.fathersName = formData.fathersName;
         payload.additionalDetails.mothersName = formData.mothersName;
      }

      const res = await axios.put(`/api/v1/users/${user._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data.user);
      setShowEditModal(false);
      toast.success('Profile updated successfully!');
    } catch(err) {
       toast.error(err.response?.data?.msg || 'Error updating profile');
    }
  };

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
    
    const fetchDesignations = async () => {
      try {
        const res = await axios.get("/api/v1/settings/designations", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.setting?.data) {
          setDesignations(res.data.setting.data);
        }
      } catch (error) {
        console.error(error);
      }
    };
    
    if (id) {
        fetchUser();
        fetchDesignations();
    }
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
              <button className="edit-btn" onClick={() => handleEditClick('profile')}>
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
                <span className="info-value">{user.designation || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Staff Type</span>
                <span className="info-value">{defDetails.staffType || "Regular"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Contact Number <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">{user.mobileNumber || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Attendance Supervisor</span>
                <span className="info-value">{defDetails.attendanceSupervisor || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Reporting Manager</span>
                <span className="info-value">{defDetails.reportingManager || "Admin"}</span>
              </div>
            </div>
          </div>

          {/* General Information */}
          <div className="info-section">
            <div className="section-header">
              <div className="section-title">General Information</div>
              <button className="edit-btn" onClick={() => handleEditClick('general')}>
                <i className="ri-pencil-line"></i> Edit
              </button>
            </div>
            <div className="info-grid">
              <div className="info-col">
                <span className="info-label">Salary Cycle</span>
                <span className="info-value">{defDetails.salaryCycle || "1"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Weekly-off Template</span>
                <span className="info-value">{defDetails.weeklyOffTemplate || "Sunday WO"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Holiday Template</span>
                <span className="info-value">{defDetails.holidayTemplate || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Leave Template</span>
                <span className="info-value">{defDetails.leaveTemplate || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Shift</span>
                <span className="info-value">{defDetails.shift || "Regular"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Attendance on Weekly Off Template</span>
                <span className="info-value">{defDetails.attendanceOnWoTemplate || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Geofence Template</span>
                <span className="info-value">{defDetails.geofenceTemplate || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Attendance Settings Templates</span>
                <span className="info-value">{defDetails.attendanceSettings || "Template 2"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Reimbursement Template</span>
                <span className="info-value">{defDetails.reimbursementTemplate || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Salary Access</span>
                <span className="info-value">{defDetails.salaryAccess || "Disabled"}</span>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="info-section">
            <div className="section-header">
              <div className="section-title">Personal Information</div>
              <button className="edit-btn" onClick={() => handleEditClick('personal')}>
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
                <span className="info-value">{defDetails.gender || "MALE"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Date of Birth <span style={{color: '#ef4444'}}>*</span></span>
                <span className="info-value">{user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("en-GB", {day: '2-digit', month: 'short', year: 'numeric'}) : "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Marital Status</span>
                <span className="info-value">{defDetails.maritalStatus || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Blood Group</span>
                <span className="info-value">{defDetails.bloodGroup || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Emergency Contact</span>
                <span className="info-value">{defDetails.emergencyContact || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Father's Name</span>
                <span className="info-value">{defDetails.fathersName || "-"}</span>
              </div>
              <div className="info-col">
                <span className="info-label">Mother's Name</span>
                <span className="info-value">{defDetails.mothersName || "-"}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Unified Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.5)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-content" style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginBottom: "20px", color: "#1f2937", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px" }}>Edit {editSection === 'profile' ? 'Profile' : editSection === 'general' ? 'General' : 'Personal'} Information</h3>
            <form onSubmit={handleSaveEdit}>
              {Object.keys(formData).map((key) => {
                const labelMap = {
                   name: "Name", employeeId: "Employee ID", designation: "Designation", mobileNumber: "Contact Number",
                   staffType: "Staff Type", attendanceSupervisor: "Attendance Supervisor", reportingManager: "Reporting Manager",
                   salaryCycle: "Salary Cycle", weeklyOffTemplate: "Weekly-off Template", holidayTemplate: "Holiday Template",
                   leaveTemplate: "Leave Template", shift: "Shift", attendanceOnWoTemplate: "Attendance on Weekly Off Template",
                   geofenceTemplate: "Geofence Template", attendanceSettings: "Attendance Settings Templates", reimbursementTemplate: "Reimbursement Template",
                   salaryAccess: "Salary Access", email: "Email", gender: "Gender", dateOfBirth: "Date of Birth",
                   maritalStatus: "Marital Status", bloodGroup: "Blood Group", emergencyContact: "Emergency Contact",
                   fathersName: "Father's Name", mothersName: "Mother's Name"
                };
                const typeMap = { email: "email", dateOfBirth: "date" };
                
                return (
                  <div key={key} style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontSize: "0.85rem", fontWeight: 600, color: "#4b5563" }}>
                      {labelMap[key] || key}
                    </label>
                    {key === "designation" && designations.length > 0 ? (
                      <select
                        name={key}
                        value={formData[key]}
                        onChange={handleFormChange}
                        style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.9rem" }}
                      >
                        <option value="">Select Designation</option>
                        {designations.map((desi, idx) => (
                           <option key={idx} value={desi}>{desi}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={typeMap[key] || "text"}
                        name={key}
                        value={formData[key]}
                        onChange={handleFormChange}
                        style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.9rem" }}
                      />
                    )}
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#4b5563" }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#2563eb", cursor: "pointer", fontWeight: 600, color: "#fff" }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
