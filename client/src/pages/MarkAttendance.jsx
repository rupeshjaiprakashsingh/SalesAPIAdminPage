// Updated Attendance Component with "Mark Attendance" button placed at the top

import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from 'react-toastify';
import "../styles/Attendance.css";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

export default function Attendance() {
  const [form, setForm] = useState({
    attendanceType: "IN",
    latitude: "",
    longitude: "",
    // deviceTime: new Date().toISOString(), // Removed: Using Server Time
    deviceId: "",
    locationAccuracy: "",
    address: "",
    batteryPercentage: "",
    networkType: "",
    remarks: "",
  });

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "AIzaSyBAbFbmXPOSgsBnhuYrCtSQ7yXK_0nB--Y", // Replace with env if possible
  });

  const [retryCount, setRetryCount] = useState(0); // Track failed attempts
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [todayRecord, setTodayRecord] = useState(null); // Store today's attendance
  const [showEarlyModal, setShowEarlyModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");

  // Generate device ID (stored permanently)
  const generateDeviceId = () => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = "dev-" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem("device_id", id);
    }
    setForm((p) => ({ ...p, deviceId: id }));
  };

  // Fetch Battery Status
  const fetchBattery = async () => {
    try {
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        setForm((p) => ({ ...p, batteryPercentage: Math.round(battery.level * 100) }));
      }
    } catch { }
  };

  // Fetch Network Type
  const fetchNetwork = () => {
    try {
      const type = navigator.connection?.effectiveType || "";
      setForm((p) => ({ ...p, networkType: type.toUpperCase() }));
    } catch { }
  };

  // Reverse Geocoding - Now returns the address string
  const fetchAddress = async (lat, lng) => {
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const addr = res.data.display_name || "";
      setForm((p) => ({ ...p, address: addr }));
      return addr;
    } catch (error) {
      return "";
    }
  };

  // Fetch GPS Location (Promisified) - Simplifed to "Previous Code" style
  const fetchLocation = (force = false) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          // If we want to enforce accuracy (unless forced)
          // 100m limit is reasonable to avoid cell tower jumps
          if (!force && acc > 100) {
            reject(new Error(`GPS accuracy is low (${Math.round(acc)}m). Try again.`));
            return;
          }

          setForm((p) => ({ ...p, latitude: lat, longitude: lng, locationAccuracy: acc }));
          resolve({ latitude: lat, longitude: lng, locationAccuracy: acc });
        },
        (err) => {
          const msg = err.message || "Location error";
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 } // Fresh data only
      );
    });
  };

  // Manual Refresh for Button
  const refreshLocationManual = async () => {
    const toastId = toast.loading("Fetching latest location...");
    try {
      const loc = await fetchLocation(retryCount >= 2);
      await fetchAddress(loc.latitude, loc.longitude);
      toast.update(toastId, { render: "Location updated!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (e) {
      toast.update(toastId, { render: "Failed to update location.", type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  const token =
    JSON.parse(localStorage.getItem("auth")) || localStorage.getItem("token") || "";

  // Fetch Today's Attendance to check previous IN time
  const fetchTodayAttendance = async () => {
    if (!token) return;
    try {
      // Decode token to get userId (simple decode payload)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.id || payload._id;

      // Use local date to ensure we get the correct "today" relative to the user
      const now = new Date();
      const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

      const res = await axios.get(`/api/v1/attendance/day/${userId}?date=${todayStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data && res.data.in) {
        setTodayRecord(res.data);
      }
    } catch (error) {
      console.error("Error fetching today's attendance", error);
    }
  };

  // On component mount
  useEffect(() => {
    generateDeviceId();
    fetchTodayAttendance();
    // Removed automatic fetching of location/battery/network on mount
  }, []);

  // Auto-switch to OUT if already checked in
  useEffect(() => {
    if (todayRecord && todayRecord.in && !todayRecord.out) {
      setForm(p => ({ ...p, attendanceType: "OUT" }));
    }
  }, [todayRecord]);

  const handleEarlySubmit = () => {
    // ... same as before
    if (!earlyReason.trim()) {
      toast.error("Please provide a reason for early checkout.");
      return;
    }
    const newRemarks = form.remarks ? `${form.remarks} | Early Reason: ${earlyReason}` : `Early Reason: ${earlyReason}`;
    markAttendance(true, newRemarks);
    setShowEarlyModal(false);
  };

  // Submit Attendance
  const markAttendance = async (bypassTimeCheck = false, customRemarks = null) => {
    setLoading(true);

    // STEP 0: Clear old data to prove freshness
    setForm(prev => ({
      ...prev,
      latitude: "",
      longitude: "",
      address: "Fetching...",
      locationAccuracy: ""
    }));

    try {
      // 1. Fetch Network & Battery (Parallel, non-blocking mostly)
      const netType = navigator.connection?.effectiveType?.toUpperCase() || "";
      let batteryPct = "";
      if (navigator.getBattery) {
        try {
          const battery = await navigator.getBattery();
          batteryPct = Math.round(battery.level * 100);
        } catch (e) { }
      }

      // STEP 1: Fetch Fresh Location
      setMsg("Step 1/3: Requesting fresh location...");

      let currentLoc = null;
      try {
        // Pass true if retryCount >= 2 to force acceptance of low accuracy
        const forceAccept = retryCount >= 2;
        currentLoc = await fetchLocation(forceAccept);
        setRetryCount(0); // Reset on success

      } catch (locErr) {
        console.warn("Location fetch failed:", locErr);
        setRetryCount(prev => prev + 1);
      }

      // CRITICAL CHECK
      if (!currentLoc || !currentLoc.latitude || !currentLoc.longitude) {
        setLoading(false);
        if (retryCount >= 2) {
          setMsg("Unable to detect location. Is GPS enabled?");
        } else {
          setMsg(`Location extraction failed. Clicking again might help (Attempt ${retryCount + 1}/3).`);
        }
        toast.error("Location not found. Please try again.");
        return;
      }

      // STEP 2: Fetch Address
      setMsg("Step 2/3: Location found. Getting address...");

      let currentAddress = "";
      try {
        currentAddress = await fetchAddress(currentLoc.latitude, currentLoc.longitude);
      } catch (addrErr) {
        console.warn("Address fetch failed", addrErr);
      }

      // Update Form with Final Data
      setForm(p => ({
        ...p,
        batteryPercentage: batteryPct,
        networkType: netType,
        latitude: currentLoc.latitude,
        longitude: currentLoc.longitude,
        locationAccuracy: currentLoc.locationAccuracy,
        address: currentAddress
      }));

      // 8-HOUR CHECK-OUT RESTRICTION LOGIC
      if (form.attendanceType === "OUT" && bypassTimeCheck !== true) {
        // ... (Logic remains same, just collapsed for brevity in this replace block if needed, but I'll include it to be safe)
        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        let userId = null;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.id || payload._id;
        } catch (e) { }

        if (userId) {
          try {
            const resCheck = await axios.get(`/api/v1/attendance/day/${userId}?date=${todayStr}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            const freshRecord = resCheck.data;
            if (freshRecord && freshRecord.in) {
              const inTime = new Date(freshRecord.in.deviceTime).getTime();
              const currentMs = new Date().getTime();
              const diffMs = currentMs - inTime;
              const diffHours = diffMs / (1000 * 60 * 60);

              if (diffHours < 8) {
                setShowEarlyModal(true);
                setLoading(false);
                return;
              }
            }
          } catch (checkErr) { /* ignore */ }
        }
      }

      // STEP 3: Submit
      setMsg("Step 3/3: Submitting data...");

      const payload = {
        ...form, // basics
        remarks: customRemarks !== null ? customRemarks : form.remarks,
        latitude: currentLoc.latitude,
        longitude: currentLoc.longitude,
        locationAccuracy: currentLoc.locationAccuracy,
        address: currentAddress,
        batteryPercentage: batteryPct,
        networkType: netType,
        deviceTime: new Date().toISOString()
      };

      console.log("Submitting Payload:", payload);

      const res = await axios.post(
        "/api/v1/attendance/mark",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const message = res.data.message || "Marked successfully";
      setMsg(message);
      toast.success(message);
      fetchTodayAttendance();

      // Reset Form Details after submission
      setForm((prev) => ({
        ...prev,
        latitude: "",
        longitude: "",
        address: "",
        locationAccuracy: "",
        batteryPercentage: "",
        networkType: "",
        remarks: ""
      }));

    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || "An error occurred";
      setMsg(errMsg);
      toast.error(errMsg);
    }

    setLoading(false);
  };

  return (
    <div className="attendance-container">

      {/* STATUS BANNER */}
      {todayRecord && todayRecord.in && !todayRecord.out && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ fontSize: '24px' }}>ℹ️</div>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: '#1e40af', fontSize: '16px' }}>Already Checked In</h3>
            <p style={{ margin: 0, color: '#1e3a8a', fontSize: '14px' }}>
              You checked in at <strong>{new Date(todayRecord.in.deviceTime).toLocaleTimeString()}</strong>.
              Standard working hours: 8 hours. Early checkout will be marked Absent.
            </p>
          </div>
        </div>
      )}

      {todayRecord && todayRecord.in && todayRecord.out && (
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '1px solid #10b981',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ fontSize: '24px' }}>✅</div>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: '#065f46', fontSize: '16px' }}>Attendance Completed</h3>
            <p style={{ margin: 0, color: '#064e3b', fontSize: '14px' }}>
              You have already checked out today. Total working hours: <strong>{todayRecord.totalHours}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="attendance-buttons">
        <button
          type="button"
          className="attendance-btn"
          disabled={loading || (todayRecord?.out)}
          onClick={markAttendance}
          style={{ opacity: todayRecord?.out ? 0.5 : 1 }}
        >
          {loading ? "Submitting..." : "Mark Attendance"}
        </button>
      </div>

      <div className="attendance-content">
        <h2>Mark Attendance</h2>
        <p>Record your check-in/check-out</p>

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
            <label>Remarks</label>
            <input
              type="text"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional remarks"
            />
          </div>
          <div className="form-group">
            <label>Latitude</label>
            <input type="text" value={form.latitude} readOnly />
          </div>

          <div className="form-group">
            <label>Longitude</label>
            <input type="text" value={form.longitude} readOnly />
          </div>

          {/* Map View */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Current Location</label>
          </div>
          {isLoaded && form.latitude && form.longitude && (
            <div style={{ height: "250px", width: "100%", marginBottom: "15px", borderRadius: "8px", overflow: "hidden" }}>
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={{ lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }}
                zoom={15}
                options={{ streetViewControl: false, mapTypeControl: false }}
              >
                <Marker position={{ lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }} />
              </GoogleMap>
            </div>
          )}

          <div className="form-group">
            <label>Time</label>
            <input type="text" value="Server Time (IST)" readOnly style={{ backgroundColor: '#eef2ff', color: '#3b82f6', fontWeight: 'bold' }} />
          </div>

          <div className="form-group">
            <div style={{ marginBottom: '5px' }}>
              <label>Address</label>
            </div>
            <textarea value={form.address} readOnly placeholder="Fetching address..." />
          </div>

          <div className="form-group">
            <label>Accuracy (meters)</label>
            <input type="text" value={form.locationAccuracy} readOnly />
          </div>

          <div className="form-group">
            <label>Battery (%)</label>
            <input type="text" value={form.batteryPercentage} readOnly />
          </div>

          <div className="form-group">
            <label>Network Type</label>
            <input type="text" value={form.networkType} readOnly />
          </div>

          <div className="form-group">
            <label>Device ID</label>
            <input type="text" value={form.deviceId} readOnly />
          </div>



          <div className="attendance-buttons">
            <button
              type="button"
              className="attendance-btn"
              disabled={loading || (todayRecord?.out)}
              onClick={markAttendance}
              style={{ opacity: todayRecord?.out ? 0.5 : 1 }}
            >
              {loading ? "Submitting..." : "Mark Attendance"}
            </button>
          </div>
        </form>


      </div>


      {/* Early Checkout Modal */}
      {
        showEarlyModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '400px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0, color: '#dc2626' }}>Early Checkout Warning</h3>
              <p style={{ color: '#4b5563', marginBottom: '15px' }}>
                If you will not complete 8 working hours then <strong>Absent</strong> will be marked for today.
              </p>

              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Why not able to complete?</label>
              <textarea
                value={earlyReason}
                onChange={(e) => setEarlyReason(e.target.value)}
                placeholder="Enter reason..."
                style={{
                  width: '100%', minHeight: '80px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', marginBottom: '15px'
                }}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowEarlyModal(false)}
                  style={{
                    padding: '8px 16px', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEarlySubmit}
                  style={{
                    padding: '8px 16px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  Mark Absent & Checkout
                </button>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
}
