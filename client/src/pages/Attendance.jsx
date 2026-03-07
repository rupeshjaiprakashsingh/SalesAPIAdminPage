// Updated Attendance Component to only fetch data on click with strict validation

import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from 'react-toastify';
import "../styles/Attendance.css";

export default function Attendance() {
  const [form, setForm] = useState({
    attendanceType: "IN",
    latitude: "",
    longitude: "",
    deviceTime: "", // Initially empty
    deviceId: "",
    locationAccuracy: "",
    address: "",
    batteryPercentage: "",
    networkType: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Generate device ID (stored permanently)
  const generateDeviceId = () => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = "dev-" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem("device_id", id);
    }
    // We update state, but this doesn't need to be "submitted" logic, just init
    setForm((p) => ({ ...p, deviceId: id }));
  };

  // On component mount - ONLY generate Device ID. No other fetching.
  useEffect(() => {
    generateDeviceId();
  }, []);

  const token =
    JSON.parse(localStorage.getItem("auth")) || localStorage.getItem("token") || "";

  // Submit Attendance - Fetches all data on demand
  const markAttendance = async () => {
    setLoading(true);
    setMsg("Fetching location and device details...");

    try {
      // 1. Fetch Network Type
      const netType = navigator.connection?.effectiveType?.toUpperCase() || "";

      // 2. Fetch Battery Status
      let batteryPct = "";
      if (navigator.getBattery) {
        try {
          const battery = await navigator.getBattery();
          batteryPct = Math.round(battery.level * 100);
        } catch (e) {
          console.warn("Battery fetch failed", e);
        }
      }

      // 3. Fetch Geolocation (Promise-wrapped)
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by this browser.");
      }

      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (err) => {
            // Map error codes to messages
            let errorMsg = "Unable to retrieve location.";
            if (err.code === 1) errorMsg = "Location permission denied.";
            else if (err.code === 2) errorMsg = "Location unavailable. Check GPS.";
            else if (err.code === 3) errorMsg = "Location request timed out.";
            reject(new Error(errorMsg));
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;

      // CRITICAL CHECK: If no location, STOP.
      if (!lat || !lng) {
        throw new Error("Coordinates not found. Please click 'Mark Attendance' again.");
      }

      // 4. Fetch Address (Reverse Geocoding)
      let addr = "";
      try {
        const res = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        );
        addr = res.data.display_name || "";
      } catch (addrErr) {
        console.warn("Address fetch failed", addrErr);
      }

      // 5. Capture Device Time
      const timestamp = new Date().toISOString();

      // 6. Update Form State (Visual Feedback for user)
      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        locationAccuracy: acc,
        address: addr,
        deviceTime: timestamp,
        batteryPercentage: batteryPct,
        networkType: netType
      }));

      // 7. Submit Data
      setMsg("Submitting data...");

      const payload = {
        ...form, // Includes current remarks, attendanceType, deviceId
        latitude: lat,
        longitude: lng,
        locationAccuracy: acc,
        address: addr,
        deviceTime: timestamp,
        batteryPercentage: batteryPct,
        networkType: netType
      };

      const res = await axios.post(
        "/api/v1/attendance/mark",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const message = res.data.message || "Marked successfully";
      setMsg(message);
      toast.success(message);

    } catch (error) {
      const errMsg = error.message || "An error occurred. Please try again.";
      setMsg(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attendance-container">

      <div className="attendance-buttons">
        <button
          type="button"
          className="attendance-btn"
          disabled={loading}
          onClick={markAttendance}
        >
          {loading ? "Processing..." : "Mark Attendance"}
        </button>
      </div>

      <div className="attendance-content">
        <h2>Mark Attendance</h2>
        <p>Record your check-in/check-out</p>

        {msg && <p className="status-message" style={{ textAlign: 'center', marginBottom: '10px' }}>{msg}</p>}

        <form className="attendance-form">
          <div className="form-group">
            <label>Attendance Type</label>
            <select
              value={form.attendanceType}
              onChange={(e) => setForm({ ...form, attendanceType: e.target.value })}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>

          <div className="form-group">
            <label>Latitude</label>
            <input type="text" value={form.latitude} readOnly placeholder="Will fetch on click" />
          </div>

          <div className="form-group">
            <label>Longitude</label>
            <input type="text" value={form.longitude} readOnly placeholder="Will fetch on click" />
          </div>

          <div className="form-group">
            <label>Device Time</label>
            <input type="text" value={form.deviceTime} readOnly placeholder="Will capture on click" />
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea value={form.address} readOnly placeholder="Will fetch on click" />
          </div>

          <div className="form-group">
            <label>Accuracy (meters)</label>
            <input type="text" value={form.locationAccuracy} readOnly placeholder="Will fetch on click" />
          </div>

          <div className="form-group">
            <label>Battery (%)</label>
            <input type="text" value={form.batteryPercentage} readOnly placeholder="Will fetch on click" />
          </div>

          <div className="form-group">
            <label>Network Type</label>
            <input type="text" value={form.networkType} readOnly placeholder="Will fetch on click" />
          </div>

          <div className="form-group">
            <label>Device ID</label>
            <input type="text" value={form.deviceId} readOnly />
          </div>

          <div className="form-group">
            <label>Remarks</label>
            <input
              type="text"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional remarks"
            />
          </div>

          <div className="attendance-buttons">
            <button
              type="button"
              className="attendance-btn"
              disabled={loading}
              onClick={markAttendance}
            >
              {loading ? "Processing..." : "Mark Attendance"}
            </button>
          </div>
        </form>


      </div>
    </div>
  );
}
