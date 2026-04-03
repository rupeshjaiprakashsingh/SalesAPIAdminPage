import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
    GoogleMap,
    Marker,
    InfoWindow,
    useJsApiLoader,
} from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "100%", borderRadius: "0" };
const defaultPosition = { lat: 19.076, lng: 72.877 };

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

// Convert lat/lng to pixel coords on the map container
function latLngToPixel(map, lat, lng) {
    const projection = map.getProjection();
    if (!projection) return null;
    const bounds = map.getBounds();
    if (!bounds) return null;
    const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
    const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
    const scale = Math.pow(2, map.getZoom());
    const point = projection.fromLatLngToPoint(
        new window.google.maps.LatLng(lat, lng)
    );
    return {
        x: (point.x - bottomLeft.x) * scale,
        y: (point.y - topRight.y) * scale,
    };
}

const getBatteryColor = (battery) => {
    if (battery == null) return "#6b7280";
    if (battery > 60) return "#16a34a";
    if (battery > 20) return "#d97706";
    return "#dc2626";
};

const getBatteryIcon = (battery) => {
    if (battery == null) return "🔋";
    if (battery > 60) return "🔋";
    if (battery > 20) return "🪫";
    return "⚠️";
};

const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "Unknown";
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
};

const LiveTracking = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [hoveredEmp, setHoveredEmp] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [mapInstance, setMapInstance] = useState(null);
    const mapContainerRef = useRef(null);
    const hideTimeout = useRef(null);

    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    });

    // ─── Fetch latest location per employee from employeelocationlogs ──────────
    const fetchLiveLocations = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get("/api/v1/location/live", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                const valid = (res.data.data || []).filter(
                    (e) => e.latitude && e.longitude
                );
                setEmployees(
                    valid.map((e) => ({
                        id: String(e.userId),
                        name: e.name || "Unknown",
                        email: e.email || "",
                        latitude: Number(e.latitude),
                        longitude: Number(e.longitude),
                        lastSeen: e.lastSeen,
                        battery: e.battery,
                        isOnline: e.isOnline,
                        accuracy: e.accuracy,
                    }))
                );
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load live locations.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveLocations();
        const interval = setInterval(fetchLiveLocations, 60000);
        return () => clearInterval(interval);
    }, [fetchLiveLocations]);

    // Auto-fit bounds
    useEffect(() => {
        if (!mapInstance || !window.google || employees.length === 0) return;
        const bounds = new window.google.maps.LatLngBounds();
        employees.forEach((e) => bounds.extend({ lat: e.latitude, lng: e.longitude }));
        mapInstance.fitBounds(bounds);
        window.google.maps.event.addListenerOnce(mapInstance, "idle", () => {
            if (mapInstance.getZoom() > 13) mapInstance.setZoom(13);
        });
    }, [mapInstance, employees]);

    const onLoad = useCallback((map) => setMapInstance(map), []);
    const onUnmount = useCallback(() => setMapInstance(null), []);

    // ─── Hover logic: convert lat/lng to pixel, show custom div tooltip ──────
    const showTooltip = useCallback(
        (emp) => {
            clearTimeout(hideTimeout.current);
            if (!mapInstance || !window.google || !mapContainerRef.current) {
                setHoveredEmp(emp);
                return;
            }
            const px = latLngToPixel(mapInstance, emp.latitude, emp.longitude);
            if (px) {
                // Clamp so tooltip doesn't go off-screen
                const containerW = mapContainerRef.current.offsetWidth;
                const tooltipW = 210;
                const x = Math.min(px.x + 16, containerW - tooltipW - 10);
                setTooltipPos({ x, y: px.y - 90 });
            }
            setHoveredEmp(emp);
        },
        [mapInstance]
    );

    const hideTooltip = useCallback(() => {
        hideTimeout.current = setTimeout(() => setHoveredEmp(null), 150);
    }, []);

    const keepTooltip = useCallback(() => {
        clearTimeout(hideTimeout.current);
    }, []);

    // Recalculate pixel position if map pans/zooms while tooltip is open
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

    const handleMarkerClick = (emp) => {
        clearTimeout(hideTimeout.current);
        setHoveredEmp(null);
        setSelectedEmp((prev) => (prev?.id === emp.id ? null : emp));
    };

    const markerIcon = (emp) => {
        if (!window.google) return undefined;
        return {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: emp.isOnline ? "#111827" : "#9ca3af",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 5,
        };
    };

    const onlineCount = employees.filter((e) => e.isOnline).length;

    return (
        <div style={{
            height: "calc(100vh - 70px)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter, sans-serif",
            background: "#f9fafb",
        }}>
            {/* ── Header ── */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 20px",
                background: "white",
                borderBottom: "1px solid #e5e7eb",
                flexWrap: "wrap",
                gap: 8,
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>
                        🗺️ Live Tracking
                    </h2>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>
                        Latest GPS position · auto-refreshes every 60s
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "3px 12px", fontSize: "0.8rem", fontWeight: 600 }}>
                        🟢 {onlineCount} Online
                    </span>
                    <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 999, padding: "3px 12px", fontSize: "0.8rem", fontWeight: 600 }}>
                        ⚫ {employees.length - onlineCount} Offline
                    </span>
                    <button
                        onClick={fetchLiveLocations}
                        disabled={loading}
                        style={{
                            padding: "6px 16px",
                            background: loading ? "#93c5fd" : "#2563eb",
                            color: "#fff", border: "none", borderRadius: 6,
                            cursor: loading ? "not-allowed" : "pointer",
                            fontSize: "0.82rem", fontWeight: 600,
                        }}
                    >
                        {loading ? "Loading…" : "🔄 Refresh"}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: "#fee2e2", padding: "8px 20px", color: "#b91c1c", fontSize: "0.83rem" }}>
                    ⚠️ {error}
                </div>
            )}

            {/* ── Main area ── */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* ── Map ── */}
                <div ref={mapContainerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={defaultPosition}
                            zoom={11}
                            onLoad={onLoad}
                            onUnmount={onUnmount}
                            options={{
                                streetViewControl: false,
                                fullscreenControl: true,
                                clickableIcons: false,
                            }}
                        >
                            {/* ── Live location markers only — no polylines, no route ── */}
                            {employees.map((emp) => (
                                <Marker
                                    key={emp.id}
                                    position={{ lat: emp.latitude, lng: emp.longitude }}
                                    icon={markerIcon(emp)}
                                    zIndex={emp.isOnline ? 10 : 1}
                                    onMouseOver={() => showTooltip(emp)}
                                    onMouseOut={hideTooltip}
                                    onClick={() => handleMarkerClick(emp)}
                                />
                            ))}

                            {/* ── Click InfoWindow (full detail) ── */}
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
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                <span style={{ color: "#6b7280" }}>Last seen</span>
                                                <span style={{ fontWeight: 600 }}>{formatRelativeTime(selectedEmp.lastSeen)}</span>
                                            </div>
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
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#666" }}>
                            Loading Maps…
                        </div>
                    )}

                    {/*
                        ── CUSTOM HOVER TOOLTIP ──────────────────────────────────────────
                        Rendered as a plain React div ON TOP of the map container.
                        This avoids the InfoWindow flicker bug entirely.
                    */}
                    {hoveredEmp && (
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
                            {/* Name */}
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                            }}>
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

                            {/* Battery row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                                <span style={{ fontSize: 18 }}>{getBatteryIcon(hoveredEmp.battery)}</span>
                                <span style={{ fontWeight: 700, fontSize: 15, color: getBatteryColor(hoveredEmp.battery) }}>
                                    {hoveredEmp.battery != null ? `${hoveredEmp.battery}%` : "N/A"}
                                </span>
                                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>
                                    {formatRelativeTime(hoveredEmp.lastSeen)}
                                </span>
                            </div>

                            {/* View Profile */}
                            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                                <a
                                    href={`/dashboard/users/${hoveredEmp.id}/profile`}
                                    style={{ color: "#2563eb", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                                >
                                    View Profile
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right sidebar ── */}
                <div style={{
                    width: 260,
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
                            No location data yet.
                        </div>
                    )}

                    {employees.map((emp) => (
                        <div
                            key={emp.id}
                            onClick={() => handleMarkerClick(emp)}
                            onMouseEnter={() => {
                                if (mapInstance) {
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
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatRelativeTime(emp.lastSeen)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveTracking;
