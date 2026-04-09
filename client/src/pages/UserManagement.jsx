import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Dashboard.css";
import "../styles/UserManagement.css";

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    const [activeTab, setActiveTab] = useState("active"); // "active" or "deactivated"
    const [deactivatedCount, setDeactivatedCount] = useState(0);
    const [token] = useState(JSON.parse(localStorage.getItem("auth")) || "");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [currentUser, setCurrentUser] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "user",
        mobileNumber: "",
        dateOfBirth: "",
        employeeId: "",
    });
    const [isEdit, setIsEdit] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `/api/v1/users?search=${search}&page=${page}&limit=10&status=${activeTab}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setUsers(response.data.users);
            setTotalPages(response.data.totalPages);
            setTotalUsersCount(response.data.totalUsers || 0);
            setLoading(false);
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error fetching users");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchDesignations();
        // Always fetch the deactivated count so badge is correct regardless of current tab
        fetchDeactivatedCount();
    }, [page, search, activeTab]);

    const fetchDesignations = async () => {
        try {
            const response = await axios.get("/api/v1/settings/designations", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.setting && response.data.setting.data) {
                setDesignations(response.data.setting.data);
            }
        } catch (error) {
            console.error("Failed to fetch designations", error);
        }
    };

    const fetchDeactivatedCount = async () => {
        try {
            const res = await axios.get(`/api/v1/users?status=deactivated&limit=1`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDeactivatedCount(res.data.totalUsers || 0);
        } catch (_) {}
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setPage(1);
        setSearch("");
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this user completely?")) {
            try {
                await axios.delete(`/api/v1/users/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success("User deleted successfully");
                fetchUsers();
            } catch (error) {
                toast.error(error.response?.data?.msg || "Error deleting user");
            }
        }
    };

    const handleToggleActiveStatus = async (user, newStatus) => {
        if (window.confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this staff member?`)) {
            try {
                await axios.put(`/api/v1/users/${user._id}`, { isActive: newStatus }, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
                fetchUsers();
            } catch (error) {
                toast.error(error.response?.data?.msg || "Error updating user status");
            }
        }
    };

    const handleResetDevice = async (id) => {
        if (window.confirm("Are you sure you want to reset the device lock for this user?")) {
            try {
                await axios.put(`/api/v1/users/${id}/reset-device`, {}, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success("Device ID reset successfully");
                fetchUsers();
            } catch (error) {
                toast.error(error.response?.data?.msg || "Error resetting device");
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await axios.put(`/api/v1/users/${currentUser._id}`, currentUser, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success("User updated successfully");
            } else {
                await axios.post("/api/v1/users", currentUser, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success("User created successfully");
            }
            setShowModal(false);
            fetchUsers();
            resetForm();
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error saving user");
        }
    };

    const openEditModal = (user) => {
        let dobStr = "";
        if (user.dateOfBirth) {
            dobStr = new Date(user.dateOfBirth).toISOString().split('T')[0];
        }
        setCurrentUser({ ...user, dateOfBirth: dobStr, password: "" }); // Don't show password
        setIsEdit(true);
        setShowModal(true);
    };

    const openAddModal = () => {
        resetForm();
        setIsEdit(false);
        setShowModal(true);
    };

    const resetForm = () => {
        setCurrentUser({ name: "", username: "", email: "", password: "", role: "user", mobileNumber: "", dateOfBirth: "", employeeId: "" });
    };

    // Close modal on Escape key
    React.useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') setShowModal(false); };
        if (showModal) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [showModal]);

    const handleAddPayment = () => {
        toast.info("Payment feature coming soon!");
    };

    return (
        <div className="user-management-container">
            <h2 className="user-management-header">Staff Management</h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                <button 
                    onClick={() => handleTabChange('active')} 
                    style={{ 
                        padding: '8px 16px', background: activeTab === 'active' ? '#2563eb' : 'transparent', 
                        color: activeTab === 'active' ? 'white' : '#4b5563', border: 'none', borderRadius: '14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem'
                    }}
                >
                    Active Staff
                </button>
                <button 
                    onClick={() => handleTabChange('deactivated')} 
                    style={{ 
                        padding: '8px 16px', background: activeTab === 'deactivated' ? '#f3f4f6' : 'transparent', 
                        color: activeTab === 'deactivated' ? '#ef4444' : '#4b5563', border: 'none', borderRadius: '14px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    Deactivated Staffs <span style={{ background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>{deactivatedCount}</span>
                </button>
            </div>

            <div className="controls">
                <input
                    type="text"
                    placeholder="Search staff by name, email, or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-input"
                />
                {activeTab === 'active' && (
                    <button className="btn btn-primary" onClick={openAddModal}>
                        Add Staff
                    </button>
                )}
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : activeTab === 'active' ? (
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Emp ID</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user._id}>
                                    <td>
                                        <Link to={`/dashboard/users/${user._id}/profile`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600, color: '#2563eb' }}>{user.name}</span>
                                                    {user.designation && <span style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>{user.designation}</span>}
                                                </div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td style={{ color: '#6b7280', fontWeight: 500 }}>{user.employeeId || "-"}</td>
                                    <td>{user.username}</td>
                                    <td>
                                        <span className={`role-badge ${user.role === "admin" ? "role-admin" : "role-user"}`}>
                                            {user.role ? user.role.toUpperCase() : "USER"}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button className="action-btn action-btn-edit" onClick={() => openEditModal(user)}>
                                                ✎ Edit
                                            </button>
                                            <button 
                                                className="action-btn"
                                                style={{ background: "#fee2e2", color: "#ef4444", border: '1px solid #fecaca' }}
                                                onClick={() => handleToggleActiveStatus(user, false)}
                                            >
                                                🚫 Deactivate
                                            </button>
                                            <button 
                                                className="action-btn"
                                                style={{ background: "#e0f2fe", color: "#0284c7" }}
                                                onClick={() => handleResetDevice(user._id)}
                                            >
                                                ↺ Reset Device
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* DEACTIVATED STAFFS VIEW */
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0', background: '#f9fafb', borderRadius: '12px' }}>
                    {users.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '20px' }}>No deactivated staff found.</p> : null}
                    {users.map((user) => (
                        <div key={user._id} style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            background: '#ffffff', padding: '12px 20px', borderRadius: '8px', 
                            border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', margin: '0 10px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path></svg>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px' }}>
                                    <span style={{ fontWeight: 600, color: '#374151', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                                        {user.name}
                                    </span>
                                    {user.designation && <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{user.designation}</span>}
                                </div>
                                <span style={{ color: '#9ca3af', fontWeight: 500, fontSize: '0.85rem' }}>
                                    {user.employeeId || "00000000"}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button 
                                    onClick={handleAddPayment}
                                    style={{ 
                                        padding: '6px 16px', border: '1px solid #bfdbfe', background: '#eff6ff', 
                                        color: '#3b82f6', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' 
                                    }}
                                >
                                    Add Payment
                                </button>
                                <button 
                                    onClick={() => handleToggleActiveStatus(user, true)}
                                    style={{ 
                                        padding: '6px 16px', border: 'none', background: '#ecfdf5', 
                                        color: '#10b981', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' 
                                    }}
                                >
                                    Activate
                                </button>
                                <button 
                                    onClick={() => handleDelete(user._id)}
                                    style={{ 
                                        padding: '6px 16px', border: 'none', background: '#fee2e2', 
                                        color: '#ef4444', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' 
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="pagination">
                <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                >
                    Prev
                </button>
                <span>
                    Page {page} of {totalPages}
                </span>
                <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                >
                    Next
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{isEdit ? "Edit Staff" : "Add Staff"}</h3>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    value={currentUser.name}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Employee ID (Auto-generated if left blank)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. EP-S-081"
                                    value={currentUser.employeeId || ""}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, employeeId: e.target.value })
                                    }
                                />
                            </div>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={currentUser.username}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, username: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={currentUser.email}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, email: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Mobile Number</label>
                                <input
                                    type="text"
                                    value={currentUser.mobileNumber || ""}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, mobileNumber: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Date of Birth</label>
                                <input
                                    type="date"
                                    value={currentUser.dateOfBirth || ""}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, dateOfBirth: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Designation</label>
                                {designations.length > 0 ? (
                                    <select
                                        value={currentUser.designation || ""}
                                        onChange={(e) =>
                                            setCurrentUser({ ...currentUser, designation: e.target.value })
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "10px",
                                            border: "1px solid #ddd",
                                            borderRadius: "6px",
                                            fontSize: "14px",
                                        }}
                                    >
                                        <option value="">Select a Role / Designation</option>
                                        {designations.map((desi, idx) => (
                                            <option key={idx} value={desi}>{desi}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Add designations in Settings first, or type manually"
                                        value={currentUser.designation || ""}
                                        onChange={(e) =>
                                            setCurrentUser({ ...currentUser, designation: e.target.value })
                                        }
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={currentUser.role || "user"}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, role: e.target.value })
                                    }
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        border: "1px solid #ddd",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                    }}
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Password {isEdit && "(Leave blank to keep current)"}</label>
                                <input
                                    type="password"
                                    value={currentUser.password}
                                    onChange={(e) =>
                                        setCurrentUser({ ...currentUser, password: e.target.value })
                                    }
                                    required={!isEdit}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn btn-success">
                                    Save
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
