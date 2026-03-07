import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Profile.css";

export default function Profile() {
  const [token, setToken] = useState(JSON.parse(localStorage.getItem("auth")) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await axios.get("/api/v1/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
        setName(res.data.name);
        setLoading(false);
      } catch (err) {
        console.error("PROFILE LOAD ERROR:", err);
        toast.error(err.response?.data?.msg || "Failed to load profile: " + err.message);
        setLoading(false);
      }
    }

    if (token) {
      loadProfile();
    }
  }, [token]);

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      const updateData = { name };
      if (password) updateData.password = password;

      const res = await axios.put(
        "/api/v1/users/profile",
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUser(res.data.user);
      setPassword(""); // Clear password field
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.msg || "Update failed!");
      console.error(err);
    }
  };

  if (loading) return <div className="profile-loading">Loading profile...</div>;

  return (
    <div className="profile-container">
      <div className="profile-content">
        <h1 className="profile-title">My Profile</h1>

        <div className="profile-card info-card">
          <div className="info-row">
            <span className="info-label">Email:</span>
            <span className="info-value">{user?.email}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Role:</span>
            <span className="info-value capitalize">{user?.role}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Device ID:</span>
            <span className="info-value mono">{user?.deviceId || "Not Linked"}</span>
          </div>
        </div>

        <h2 className="section-title">Update Information</h2>

        <form className="profile-form" onSubmit={handleUpdate}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="form-group">
            <label>New Password <span className="optional">(leave blank to keep current)</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <button type="submit" className="profile-btn">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
