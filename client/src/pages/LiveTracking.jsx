import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
    GoogleMap,
    Marker,
    InfoWindow,
    Polyline,
    useJsApiLoader,
} from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "100%", borderRadius: "10px" };
const defaultPosition = { lat: 28.6139, lng: 77.209 };

const getToken = () => {
    const authItem = localStorage.getItem("auth");
    if (!authItem) return null;
    try {
        return authItem.startsWith("{")
            ? JSON.parse(authItem).token
            : JSON.parse(authItem);
    } catch {
        return null;
    }
};

const LiveTracking = () => {
    const todayStr = new Date().toISOString().split("T")[0];

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [userRoute, setUserRoute] = useState(null);
    const [stats, setStats] = useState({ count: 0, checkedIn: 0, checkedOut: 0 });
    const [mapInstance, setMapInstance] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: "AIzaSyBAbFbmXPOSgsBnhuYrCtSQ7yXK_0nB--Y",
    });

    // ─── Fetch Live Locations ───────────────────────────────────────────────────
    // Uses /api/v1/attendance/live-locations — today's check-ins with live GPS position
    const fetchLiveLocations = useCallback(async () => {
        const token = getToken();
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const res = await axios.get("/api/v1/attendance/live-locations", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.data.success) {
                // Filter out records with no location
                const valid = (res.data.data || []).filter(
                    (e) => e.latitude && e.longitude
                );

                // Build employee objects compatible with map rendering
                const mapped = valid.map((e) => ({
                    id: String(e.userId),
                    actualUserId: String(e.userId),
                    name: e.name || "Unknown",
                    email: e.email || "",
                    mobileNumber: e.mobileNumber || "",
                    latitude: Number(e.latitude),
                    longitude: Number(e.longitude),
                    lastLocationUpdated: e.lastLocationUpdated,
                    battery: e.battery,
                    isOnline: e.isOnline,
                    // Attendance
                    checkedOut: e.checkedOut,
                    status: e.checkedOut ? "Checked Out" : "Checked In",
                    checkInTime: e.checkInTime,
                    checkInAddress: e.checkInAddress,
                    checkInLocation: e.checkInLocation,
                    checkOutTime: e.checkOutTime,
                    checkOutAddress: e.checkOutAddress,
                    workingHours: e.workingHours,
                    geofenceValidated: e.geofenceValidated,
                    // For timeline fetch
                    date: todayStr,
                }));

                setEmployees(mapped);
                setStats({
                    count: res.data.count,
                    checkedIn: res.data.checkedInCount,
                    checkedOut: res.data.checkedOutCount,
                });
            }
        } catch (err) {
            console.error("[LiveTracking] Error fetching live locations:", err);
            setError(
                err.response?.data?.message ||
                "Failed to load live locations. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [todayStr]);

    // Fetch data once on mount
    useEffect(() => {
        fetchLiveLocations();
    }, [fetchLiveLocations]);

    // ─── Fetch Timeline Path when employee is selected ─────────────────────────
    useEffect(() => {
        const fetchTimeline = async () => {
            if (!selectedEmp) {
                setUserRoute(null);
                return;
            }
            try {
                const token = getToken();
                if (!token) return;

                const res = await axios.get(
                    `/api/v1/reports/timeline-report?userId=${selectedEmp.actualUserId}&date=${selectedEmp.date}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (res.data.success && res.data.data?.route?.length > 0) {
                    setUserRoute(res.data.data.route);
                } else {
                    setUserRoute([]);
                }
            } catch (err) {
                console.error("[LiveTracking] Error fetching timeline:", err);
                setUserRoute([]);
            }
        };
        fetchTimeline();
    }, [selectedEmp]);

    // ─── Map Auto-Fit Logic ────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapInstance || !window.google) return;

        if (selectedEmp) {
            // Re-center on selected employee
            mapInstance.panTo({ lat: selectedEmp.latitude, lng: selectedEmp.longitude });
            mapInstance.setZoom(15);
        } else if (employees.length > 0) {
            // Fit bounds to show all employees
            const bounds = new window.google.maps.LatLngBounds();
            employees.forEach((emp) => {
                if (emp.latitude && emp.longitude) {
                    bounds.extend({ lat: emp.latitude, lng: emp.longitude });
                }
            });
            mapInstance.fitBounds(bounds);
            
            // Prevent map from zooming in too far when markers are very close
            window.google.maps.event.addListenerOnce(mapInstance, "idle", () => {
                if (mapInstance.getZoom() > 14) {
                    mapInstance.setZoom(14);
                }
            });
        }
    }, [mapInstance, employees, selectedEmp]);

    // ─── Handlers ──────────────────────────────────────────────────────────────
    const handleEmployeeClick = (emp) => {
        setSelectedEmp((prev) => (prev?.id === emp.id ? null : emp));
    };

    const onLoad = useCallback(function callback(map) {
        setMapInstance(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMapInstance(null);
    }, []);

    const mapCenter = defaultPosition; // Managed by fitBounds/panTo dynamically

    // ─── Icons ─────────────────────────────────────────────────────────────────
    const onlineIcon = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    const offlineIcon = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    const checkedOutIcon = "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
    const liveIcon = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";

    const pathOptions = {
        strokeColor: "#3b82f6",
        strokeOpacity: 0.85,
        strokeWeight: 4,
    };

    // ─── Helpers ───────────────────────────────────────────────────────────────
    const formatTime = (dateStr) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatWorkingHours = (hrs) => {
        if (hrs == null) return "N/A";
        const h = Math.floor(hrs);
        const m = Math.round((hrs - h) * 60);
        return `${h}h ${m}m`;
    };

    const getMarkerIcon = (emp) => {
        if (emp.checkedOut) return checkedOutIcon;
        if (emp.isOnline) return onlineIcon;
        return offlineIcon;
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                height: "calc(100vh - 100px)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                }}
            >
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "bold" }}>
                        🗺️ Live Tracking
                    </h2>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
                        Today's field staff
                    </p>
                </div>

                {/* Stats badges */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span
                        style={{
                            background: "#dcfce7",
                            color: "#166534",
                            borderRadius: "999px",
                            padding: "4px 12px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                        }}
                    >
                        ● {stats.checkedIn} Checked In
                    </span>
                    <span
                        style={{
                            background: "#fef9c3",
                            color: "#713f12",
                            borderRadius: "999px",
                            padding: "4px 12px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                        }}
                    >
                        ● {stats.checkedOut} Checked Out
                    </span>
                    <button
                        onClick={fetchLiveLocations}
                        disabled={loading}
                        style={{
                            padding: "6px 16px",
                            background: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.7 : 1,
                            fontSize: "0.85rem",
                        }}
                    >
                        {loading ? "Refreshing…" : "🔄 Refresh"}
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div
                    style={{
                        background: "#fee2e2",
                        border: "1px solid #f87171",
                        borderRadius: "6px",
                        padding: "10px 16px",
                        color: "#b91c1c",
                        fontSize: "0.85rem",
                    }}
                >
                    ⚠️ {error}
                </div>
            )}

            {/* Map */}
            <div
                style={{
                    flexGrow: 1,
                    width: "100%",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid #ddd",
                    minHeight: "350px",
                }}
            >
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={mapCenter}
                        zoom={12}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                    >
                        {/* All staff markers (when no one selected) */}
                        {!selectedEmp &&
                            employees.map((emp) => (
                                <Marker
                                    key={emp.id}
                                    position={{ lat: emp.latitude, lng: emp.longitude }}
                                    icon={getMarkerIcon(emp)}
                                    title={`${emp.name} — ${emp.status}`}
                                    onClick={() => handleEmployeeClick(emp)}
                                />
                            ))}

                        {/* Selected employee: route + markers */}
                        {selectedEmp && (
                            <>
                                {/* Route polyline */}
                                {userRoute && userRoute.length > 0 && (
                                    <Polyline
                                        path={userRoute.map((p) => ({
                                            lat: Number(p.lat),
                                            lng: Number(p.lng),
                                        }))}
                                        options={pathOptions}
                                    />
                                )}

                                {/* Check-IN marker */}
                                {selectedEmp.checkInLocation?.lat && (
                                    <Marker
                                        position={{
                                            lat: Number(selectedEmp.checkInLocation.lat),
                                            lng: Number(selectedEmp.checkInLocation.lng),
                                        }}
                                        label="IN"
                                        title={`Check-In: ${formatTime(selectedEmp.checkInTime)}`}
                                        icon={onlineIcon}
                                    />
                                )}

                                {/* Check-OUT marker */}
                                {selectedEmp.checkOutAddress && selectedEmp.latitude && (
                                    <Marker
                                        position={{
                                            lat: Number(selectedEmp.latitude),
                                            lng: Number(selectedEmp.longitude),
                                        }}
                                        label="OUT"
                                        title={`Check-Out: ${formatTime(selectedEmp.checkOutTime)}`}
                                        icon={checkedOutIcon}
                                    />
                                )}

                                {/* Current live position marker + InfoWindow */}
                                <Marker
                                    position={{
                                        lat: selectedEmp.latitude,
                                        lng: selectedEmp.longitude,
                                    }}
                                    icon={selectedEmp.isOnline ? liveIcon : offlineIcon}
                                    title="Current Position"
                                    onClick={() => setSelectedEmp(null)}
                                >
                                    <InfoWindow
                                        position={{
                                            lat: selectedEmp.latitude,
                                            lng: selectedEmp.longitude,
                                        }}
                                        onCloseClick={() => setSelectedEmp(null)}
                                    >
                                        <div style={{ minWidth: "220px", fontFamily: "sans-serif" }}>
                                            <h3
                                                style={{
                                                    margin: "0 0 8px 0",
                                                    fontSize: "1rem",
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                {selectedEmp.name}
                                            </h3>
                                            <table
                                                style={{
                                                    width: "100%",
                                                    fontSize: "0.82rem",
                                                    borderCollapse: "collapse",
                                                }}
                                            >
                                                <tbody>
                                                    <tr>
                                                        <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                            <strong>Status</strong>
                                                        </td>
                                                        <td
                                                            style={{
                                                                color: selectedEmp.checkedOut
                                                                    ? "#d97706"
                                                                    : selectedEmp.isOnline
                                                                    ? "#16a34a"
                                                                    : "#dc2626",
                                                                fontWeight: "bold",
                                                                paddingBottom: "4px",
                                                            }}
                                                        >
                                                            {selectedEmp.status}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                            <strong>Battery</strong>
                                                        </td>
                                                        <td style={{ paddingBottom: "4px" }}>
                                                            {selectedEmp.battery != null
                                                                ? `${selectedEmp.battery}%`
                                                                : "N/A"}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                            <strong>Check In</strong>
                                                        </td>
                                                        <td style={{ paddingBottom: "4px" }}>
                                                            {formatTime(selectedEmp.checkInTime)}
                                                        </td>
                                                    </tr>
                                                    {selectedEmp.checkedOut && (
                                                        <>
                                                            <tr>
                                                                <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                                    <strong>Check Out</strong>
                                                                </td>
                                                                <td style={{ paddingBottom: "4px" }}>
                                                                    {formatTime(selectedEmp.checkOutTime)}
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                                    <strong>Working Hrs</strong>
                                                                </td>
                                                                <td style={{ paddingBottom: "4px" }}>
                                                                    {formatWorkingHours(selectedEmp.workingHours)}
                                                                </td>
                                                            </tr>
                                                        </>
                                                    )}
                                                    {selectedEmp.checkInAddress && (
                                                        <tr>
                                                            <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                                <strong>Location</strong>
                                                            </td>
                                                            <td
                                                                style={{
                                                                    paddingBottom: "4px",
                                                                    maxWidth: "150px",
                                                                    wordBreak: "break-word",
                                                                    fontSize: "0.76rem",
                                                                }}
                                                            >
                                                                {selectedEmp.checkInAddress}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    <tr>
                                                        <td style={{ color: "#555", paddingBottom: "4px" }}>
                                                            <strong>Geofence</strong>
                                                        </td>
                                                        <td style={{ paddingBottom: "4px" }}>
                                                            {selectedEmp.geofenceValidated ? "✅ Inside" : "❌ Outside"}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <button
                                                onClick={() => setSelectedEmp(null)}
                                                style={{
                                                    marginTop: "10px",
                                                    width: "100%",
                                                    background: "#e2e8f0",
                                                    border: "none",
                                                    padding: "6px",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </InfoWindow>
                                </Marker>
                            </>
                        )}
                    </GoogleMap>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            height: "100%",
                            color: "#666",
                        }}
                    >
                        Loading Maps…
                    </div>
                )}
            </div>

            {/* Legend */}
            <div
                style={{
                    display: "flex",
                    gap: "16px",
                    fontSize: "0.75rem",
                    color: "#555",
                    flexWrap: "wrap",
                }}
            >
                <span>🟢 Online & Checked In</span>
                <span>🟡 Checked Out</span>
                <span>🔴 Offline (no ping &gt; 30 min)</span>
                <span>🔵 Selected / Live Position</span>
            </div>

            {/* Staff cards panel */}
            <div style={{ overflowY: "auto", maxHeight: "200px" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: "bold" }}>
                    Field Staff Today ({employees.length}) — Click to view path
                </h3>

                {employees.length === 0 && !loading && (
                    <div style={{ color: "#888", fontSize: "0.85rem" }}>
                        No staff have checked in today yet.
                    </div>
                )}

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {employees.map((emp) => (
                        <div
                            key={emp.id}
                            onClick={() => handleEmployeeClick(emp)}
                            style={{
                                padding: "0.7rem 1rem",
                                border:
                                    selectedEmp?.id === emp.id
                                        ? "2px solid #3b82f6"
                                        : "1px solid #e5e7eb",
                                borderRadius: "8px",
                                background: emp.checkedOut
                                    ? "#fffbeb"
                                    : emp.isOnline
                                    ? "#f0fdf4"
                                    : "#fef2f2",
                                width: "190px",
                                cursor: "pointer",
                                transition: "all 0.15s",
                                boxShadow:
                                    selectedEmp?.id === emp.id
                                        ? "0 4px 10px rgba(59,130,246,0.25)"
                                        : "0 1px 3px rgba(0,0,0,0.07)",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>
                                    {emp.checkedOut ? "🟡" : emp.isOnline ? "🟢" : "🔴"}
                                </span>
                                <strong style={{ fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {emp.name}
                                </strong>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "4px" }}>
                                {emp.status}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#999", marginTop: "2px" }}>
                                In: {formatTime(emp.checkInTime)}
                                {emp.battery != null ? ` · 🔋${emp.battery}%` : ""}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveTracking;
