import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { getToken, latLngToPixel, getBatteryColor, getBatteryIcon, containerStyle, defaultPosition } from "./geoUtils";

const LiveTrackingTab = ({ isLoaded }) => {
    const todayStr = new Date().toISOString().split("T")[0];

    const [employees, setEmployees] = useState([]);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [loading, setLoading] = useState(false);

    const [hoveredEmp, setHoveredEmp] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const mapContainerRef = useRef(null);
    const hideTimeout = useRef(null);


    const fetchLiveLocations = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.get("/api/v1/attendance/live-locations", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                const valid = (res.data.data || []).filter((e) => e.latitude && e.longitude);
                const mapped = valid.map((e) => ({
                    id: String(e.userId),
                    actualUserId: String(e.userId),
                    name: e.name || "Unknown",
                    latitude: Number(e.latitude),
                    longitude: Number(e.longitude),
                    battery: e.battery,
                    isOnline: e.isOnline,
                    status: e.checkedOut ? "Checked Out" : "Checked In",
                    checkInTime: e.checkInTime,
                    date: todayStr,
                }));
                setEmployees(mapped);
            }
        } catch (err) {
            console.error("Error fetching live locations:", err);
        } finally {
            setLoading(false);
        }
    }, [todayStr]);

    useEffect(() => {
        fetchLiveLocations();
        // Set interval for immediate live monitoring (matches app sync rate)
        const interval = setInterval(fetchLiveLocations, 10000);
        return () => clearInterval(interval);
    }, [fetchLiveLocations]);

    // Map centering
    useEffect(() => {
        if (!mapInstance || !window.google) return;
        if (selectedEmp) {
            mapInstance.panTo({ lat: selectedEmp.latitude, lng: selectedEmp.longitude });
            mapInstance.setZoom(15);
        } else if (employees.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            employees.forEach((emp) => {
                if (emp.latitude && emp.longitude) bounds.extend({ lat: emp.latitude, lng: emp.longitude });
            });
            mapInstance.fitBounds(bounds);
            window.google.maps.event.addListenerOnce(mapInstance, "idle", () => {
                if (mapInstance.getZoom() > 14) mapInstance.setZoom(14);
            });
        }
    }, [mapInstance, employees, selectedEmp]);

    const onLoad = useCallback((map) => setMapInstance(map), []);
    const onUnmount = useCallback(() => setMapInstance(null), []);

    const showTooltip = useCallback((emp) => {
        clearTimeout(hideTimeout.current);
        if (!mapInstance || !window.google || !mapContainerRef.current) {
            setHoveredEmp(emp);
            return;
        }
        const px = latLngToPixel(mapInstance, emp.latitude, emp.longitude);
        if (px) {
            const containerW = mapContainerRef.current.offsetWidth;
            const tooltipW = 210;
            const x = Math.min(px.x + 16, containerW - tooltipW - 10);
            setTooltipPos({ x, y: px.y - 90 });
        }
        setHoveredEmp(emp);
    }, [mapInstance]);

    const hideTooltip = useCallback(() => {
        hideTimeout.current = setTimeout(() => setHoveredEmp(null), 150);
    }, []);

    const keepTooltip = useCallback(() => {
        clearTimeout(hideTimeout.current);
    }, []);

    useEffect(() => {
        if (!mapInstance || !hoveredEmp) return;
        const listener = mapInstance.addListener("bounds_changed", () => {
            const px = latLngToPixel(mapInstance, hoveredEmp.latitude, hoveredEmp.longitude);
            if (px) {
                const containerW = mapContainerRef.current?.offsetWidth || 800;
                const tooltipW = 210;
                const x = Math.min(px.x + 16, containerW - tooltipW - 10);
                setTooltipPos({ x, y: px.y - 90 });
            }
        });
        return () => window.google.maps.event.removeListener(listener);
    }, [mapInstance, hoveredEmp]);

    // Reverse geocode selected employee on-demand
    useEffect(() => {
        if (!isLoaded || !selectedEmp || selectedEmp.address || !window.google?.maps?.Geocoder) return;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: selectedEmp.latitude, lng: selectedEmp.longitude } }, (results, status) => {
            if (status === "OK" && results[0]) {
                const addr = results[0].formatted_address;
                setSelectedEmp(p => p?.id === selectedEmp.id ? { ...p, address: addr } : p);
                setEmployees(list => list.map(e => e.id === selectedEmp.id ? { ...e, address: addr } : e));
                
                // Save to backend (optional but helpful)
                const token = getToken();
                axios.put("/api/v1/location/address", {
                    employeeId: selectedEmp.actualUserId,
                    lat: selectedEmp.latitude,
                    lng: selectedEmp.longitude,
                    address: addr
                }, { headers: { Authorization: `Bearer ${token}` } }).catch(e => console.error("Error saving live geocode:", e));
            }
        });
    }, [selectedEmp, isLoaded]);

    return (
        <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 160px)', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <div ref={mapContainerRef} className="geo-map-container" style={{ position: 'relative', flex: 1, height: '100%' }}>
            {isLoaded ? (
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={defaultPosition}
                    zoom={12}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{ disableDefaultUI: false, clickableIcons: false }}
                >
                    {!selectedEmp && employees.map((emp) => (
                        <Marker
                            key={emp.id}
                            position={{ lat: emp.latitude, lng: emp.longitude }}
                            onClick={() => setSelectedEmp(emp)}
                            onMouseOver={() => showTooltip(emp)}
                            onMouseOut={hideTooltip}
                            icon={{
                                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                scale: 5,
                                fillColor: emp.isOnline ? '#111827' : '#9ca3af',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2
                            }}
                            zIndex={emp.isOnline ? 10 : 1}
                        />
                    ))}

                    {selectedEmp && (
                        <InfoWindow
                            position={{ lat: selectedEmp.latitude, lng: selectedEmp.longitude }}
                            onCloseClick={() => setSelectedEmp(null)}
                            options={{ pixelOffset: new window.google.maps.Size(0, -38) }}
                        >
                            <div style={{ padding: "10px 12px", minWidth: 200, fontFamily: "Inter, sans-serif" }}>
                                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, textTransform: "uppercase", color: "#111827" }}>
                                    {selectedEmp.name}
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#6b7280" }}>Status</span>
                                        <span style={{ fontWeight: 600, color: selectedEmp.isOnline ? "#16a34a" : "#6b7280" }}>
                                            {selectedEmp.isOnline ? "🟢 Online" : "⚫ Offline"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#6b7280" }}>Battery</span>
                                        <span style={{ fontWeight: 600, color: getBatteryColor(selectedEmp.battery) }}>
                                            {getBatteryIcon(selectedEmp.battery)} {selectedEmp.battery != null ? `${selectedEmp.battery}%` : "N/A"}
                                        </span>
                                    </div>
                                    {selectedEmp.address && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                                            <span style={{ color: "#6b7280" }}>Location</span>
                                            <span style={{ fontWeight: 500, color: "#374151", fontSize: 12 }}>
                                                <i className="ri-map-pin-line" style={{ marginRight: 4, color: "#3b82f6" }}></i>
                                                {selectedEmp.address}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8, marginTop: 8 }}>
                                    <a
                                        href={`/dashboard/users/${selectedEmp.id}/profile`}
                                        style={{ color: "#2563eb", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                                    >
                                        View Profile →
                                    </a>
                                </div>
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
            ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f3f4f6", color: "#6b7280" }}>
                    Loading Tracking Map...
                </div>
            )}

            {/* Hover Tooltip */}
            {hoveredEmp && !selectedEmp && (
                <div
                    onMouseEnter={keepTooltip}
                    onMouseLeave={hideTooltip}
                    style={{
                        position: "absolute",
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        zIndex: 9999,
                        background: "white",
                        borderRadius: 8,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                        padding: "12px 14px",
                        minWidth: 200,
                        pointerEvents: "auto",
                        fontFamily: "Inter, sans-serif",
                        border: "1px solid #e5e7eb",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827", textTransform: "uppercase" }}>
                            {hoveredEmp.name}
                        </p>
                        <button
                            onClick={() => setHoveredEmp(null)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1, padding: 0 }}
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <span style={{ fontSize: 18 }}>{getBatteryIcon(hoveredEmp.battery)}</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: getBatteryColor(hoveredEmp.battery) }}>
                            {hoveredEmp.battery != null ? `${hoveredEmp.battery}%` : "N/A"}
                        </span>
                    </div>
                    <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                        <a
                            href={`/dashboard/users/${hoveredEmp.actualUserId || hoveredEmp.id}/profile`}
                            style={{ color: "#2563eb", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                        >
                            View Profile
                        </a>
                    </div>
                </div>
            )}
            </div>

            {/* Sidebar List of All Field Staff */}
            <div style={{
                width: 280,
                background: "white",
                borderLeft: "1px solid #e5e7eb",
                overflowY: "auto",
                flexShrink: 0,
            }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                    <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "0.5px" }}>
                        FIELD STAFF ({employees.length})
                    </h3>
                </div>

                {!loading && employees.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                        No live tracking data yet.
                    </div>
                )}

                {employees.map((emp) => (
                    <div
                        key={emp.id}
                        onClick={() => setSelectedEmp(emp)}
                        onMouseEnter={() => {
                            if (mapInstance && emp.latitude && emp.longitude) {
                                mapInstance.panTo({ lat: emp.latitude, lng: emp.longitude });
                            }
                            showTooltip(emp);
                        }}
                        onMouseLeave={hideTooltip}
                        style={{
                            padding: "10px 14px",
                            borderBottom: "1px solid #f9fafb",
                            cursor: "pointer",
                            background: selectedEmp?.id === emp.id ? "#eff6ff" : "white",
                            borderLeft: selectedEmp?.id === emp.id ? "3px solid #2563eb" : "3px solid transparent",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 9 }}>{emp.isOnline ? "🟢" : "⚫"}</span>
                            <span style={{ fontWeight: 600, fontSize: 13, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {emp.name}
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: getBatteryColor(emp.battery), fontWeight: 600 }}>
                                {getBatteryIcon(emp.battery)} {emp.battery != null ? `${emp.battery}%` : "N/A"}
                            </span>
                            <span style={{ fontSize: 11, color: emp.status === "Checked In" ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>
                                {emp.status}
                            </span>
                        </div>
                        {emp.address && emp.address !== "Location not available" && (
                            <div style={{ marginTop: 4, fontSize: "0.65rem", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                <i className="ri-map-pin-line" style={{ marginRight: 2 }}></i>{emp.address}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveTrackingTab;
