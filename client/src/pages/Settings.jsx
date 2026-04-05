import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Dashboard.css"; // Reuse existing clean styles

export default function Settings() {
  const [designations, setDesignations] = useState([]);
  const [newDesignation, setNewDesignation] = useState("");
  const [loading, setLoading] = useState(true);

  const token =
    JSON.parse(localStorage.getItem("auth")) ||
    localStorage.getItem("token") ||
    "";

  useEffect(() => {
    fetchDesignations();
  }, []);

  const fetchDesignations = async () => {
    try {
      const res = await axios.get("/api/v1/settings/designations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.setting && res.data.setting.data) {
        setDesignations(res.data.setting.data);
      }
    } catch (error) {
      toast.error("Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  const saveDesignations = async (updatedList) => {
    try {
      await axios.put(
        "/api/v1/settings/designations",
        { data: updatedList },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDesignations(updatedList);
      toast.success("Settings updated");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const handleAddDesignation = () => {
    if (!newDesignation.trim()) return;
    if (designations.includes(newDesignation.trim())) {
      toast.error("Designation already exists");
      return;
    }
    const updated = [...designations, newDesignation.trim()];
    saveDesignations(updated);
    setNewDesignation("");
  };

  const handleRemoveDesignation = (desi) => {
    const updated = designations.filter((d) => d !== desi);
    saveDesignations(updated);
  };

  if (loading) return <div style={{ padding: "40px" }}>Loading Settings...</div>;

  return (
    <div className="user-management-container" style={{ padding: "24px" }}>
      <h2 className="user-management-header" style={{ marginBottom: "20px" }}>System Settings</h2>

      <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", maxWidth: "600px" }}>
        <h3 style={{ color: "#374151", marginBottom: "16px", fontSize: "1.1rem" }}>Role & Designation Definitions</h3>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "20px" }}>
          Define the official designations / roles that are available when creating or editing a staff member.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <input
            type="text"
            value={newDesignation}
            onChange={(e) => setNewDesignation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDesignation()}
            placeholder="e.g. Sales Executive"
            style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" }}
          />
          <button
            onClick={handleAddDesignation}
            style={{ background: "#2563eb", color: "white", padding: "10px 20px", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
          >
            Add
          </button>
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {designations.map((desi, index) => (
            <li
              key={index}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px"
              }}
            >
              <span style={{ fontWeight: 500, color: "#1f2937" }}>{desi}</span>
              <button
                onClick={() => handleRemoveDesignation(desi)}
                style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
              >
                Delete
              </button>
            </li>
          ))}
          {designations.length === 0 && (
            <div style={{ color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No designations defined yet.</div>
          )}
        </ul>
      </div>
    </div>
  );
}
