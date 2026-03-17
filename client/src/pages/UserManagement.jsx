import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Dashboard.css";
import "../styles/UserManagement.css";

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
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
    });
    const [isEdit, setIsEdit] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `/api/v1/users?search=${search}&page=${page}&limit=10`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setUsers(response.data.users);
            setTotalPages(response.data.totalPages);
            setLoading(false);
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error fetching users");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page, search]);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
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
        setCurrentUser({ name: "", username: "", email: "", password: "", role: "user", mobileNumber: "", dateOfBirth: "" });
    };

    return (
        <div className="user-management-container">
            <h2 className="user-management-header">Staff Management</h2>

            <div className="controls">
                <input
                    type="text"
                    placeholder="Search staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-input"
                />
                <button className="btn btn-primary" onClick={openAddModal}>
                    Add Staff
                </button>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user._id}>
                                    <td>{user.name}</td>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span
                                            style={{
                                                padding: "4px 8px",
                                                borderRadius: "4px",
                                                backgroundColor:
                                                    user.role === "admin" ? "#e3f2fd" : "#f5f5f5",
                                                color: user.role === "admin" ? "#1976d2" : "#616161",
                                                fontWeight: "500",
                                                fontSize: "12px",
                                            }}
                                        >
                                            {user.role ? user.role.toUpperCase() : "USER"}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-sm btn-warning"
                                            onClick={() => openEditModal(user)}
                                            style={{ marginRight: "5px" }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDelete(user._id)}
                                        >
                                            Delete
                                        </button>
                                        <button
                                            className="btn btn-sm btn-info"
                                            onClick={() => handleResetDevice(user._id)}
                                            style={{ marginLeft: "5px", backgroundColor: "#17a2b8", borderColor: "#17a2b8", color: "white" }}
                                        >
                                            Reset Device
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
