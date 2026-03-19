import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { GoogleMap, Marker, InfoWindow, Polyline, useJsApiLoader } from "@react-google-maps/api";
import "../styles/GeoDashboard.css";

const containerStyle = { width: "100%", height: "100%", borderRadius: "10px" };
const defaultPosition = { lat: 19.182, lng: 72.969 }; // Center around Thane/Dombivli based on screenshot

const getToken = () => {
    const authItem = localStorage.getItem("auth");
    if (!authItem) return null;
    try {
        return authItem.startsWith("{") ? JSON.parse(authItem).token : JSON.parse(authItem);
    } catch {
        return null;
    }
};

const GeoDashboard = () => {
    const [activeTab, setActiveTab] = useState("Timeline");
    const tabs = ["Live Tracking", "Timeline", "Dashboard", "Reports", "Settings", "How To Use"];

    // ─── Live Tracking State ──────────────────────────────────────────
    const [employees, setEmployees] = useState([]);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [userRoute, setUserRoute] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [loading, setLoading] = useState(false);
    const todayStr = new Date().toISOString().split("T")[0];

    // ─── Timeline State ──────────────────────────────────────────────
    const [usersList, setUsersList] = useState([]);
    const [timelineUser, setTimelineUser] = useState("");
    const [timelineDate, setTimelineDate] = useState(todayStr);
    const [timelineReport, setTimelineReport] = useState(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineMapInstance, setTimelineMapInstance] = useState(null);
    const [timelineEvents, setTimelineEvents] = useState([]);

    // ─── Dashboard Tab State ──────────────────────────────────────
    const [dashboardDate, setDashboardDate] = useState(todayStr);
    const [searchQuery, setSearchQuery] = useState("");
    const [dashboardStats, setDashboardStats] = useState({ summary: {}, data: [] });
    const [dashboardLoading, setDashboardLoading] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: "AIzaSyBAbFbmXPOSgsBnhuYrCtSQ7yXK_0nB--Y", 
    });

    // Fetch users list for Timeline dropdown
    useEffect(() => {
        const fetchUsers = async () => {
            const token = getToken();
            if (!token) return;
            try {
                const res = await axios.get("/api/v1/users?limit=1000", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUsersList(res.data.users || []);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };
        fetchUsers();
    }, []);

    // Set default user
    useEffect(() => {
        if(usersList.length > 0 && !timelineUser) {
            setTimelineUser(usersList[0]._id);
        }
    }, [usersList, timelineUser]);

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
        if (activeTab === "Live Tracking") {
            fetchLiveLocations();
        }
    }, [activeTab, fetchLiveLocations]);

    // Live Tracking timeline fetching
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
                setUserRoute([]);
            }
        };
        if (activeTab === "Live Tracking") fetchTimeline();
    }, [selectedEmp, activeTab]);

    // Main Timeline View Report
    useEffect(() => {
        const fetchTimelineReport = async () => {
            if (!timelineUser || activeTab !== "Timeline") return;
            const token = getToken();
            setTimelineLoading(true);
            try {
                const res = await axios.get(`/api/v1/reports/timeline-report?userId=${timelineUser}&date=${timelineDate}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                const report = res.data.data;
                setTimelineReport(report);

                let events = [];
                if (report && report.route && report.route.length > 0) {
                    events.push({
                        type: "Start",
                        time: report.route[0].time,
                        label: "Tracking Started"
                    });
                    
                    if(report.stopDetails) {
                        report.stopDetails.forEach(stop => {
                            events.push({
                                type: "Stop",
                                time: stop.startTime,
                                duration: stop.duration,
                                address: stop.address || "Unknown Location",
                                lat: stop.latitude,
                                lng: stop.longitude
                            });
                        });
                    }
                    
                    events.sort((a,b) => new Date(a.time) - new Date(b.time));
                    
                    let withDrives = [];
                    for(let i=0; i<events.length; i++){
                        withDrives.push(events[i]);
                        if(i < events.length - 1) {
                            withDrives.push({
                                type: "Drive",
                                time: new Date(new Date(events[i].time).getTime() + 60000).toISOString(), 
                                label: "Drive",
                                dummyKm: (Math.random() * 2 + 0.1).toFixed(2),
                                dummyMin: Math.floor(Math.random() * 15 + 2)
                            });
                        }
                    }
                    setTimelineEvents(withDrives);
                } else {
                     setTimelineEvents([]);
                }
            } catch (err) {
                console.error(err);
                setTimelineReport(null);
                setTimelineEvents([]);
            } finally {
                setTimelineLoading(false);
            }
        };
        fetchTimelineReport();
    }, [timelineUser, timelineDate, activeTab]);

    // Map centering logic for Live Tracking
    useEffect(() => {
        if (!mapInstance || !window.google || activeTab !== "Live Tracking") return;
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
    }, [mapInstance, employees, selectedEmp, activeTab]);

    // Map centering logic for Timeline Mode
    useEffect(() => {
        if (!timelineMapInstance || !window.google || activeTab !== "Timeline" || !timelineReport || timelineReport.route.length === 0) return;
        
        const bounds = new window.google.maps.LatLngBounds();
        timelineReport.route.forEach((point) => {
            if (point.lat && point.lng) bounds.extend({ lat: Number(point.lat), lng: Number(point.lng) });
        });
        timelineMapInstance.fitBounds(bounds);
        window.google.maps.event.addListenerOnce(timelineMapInstance, "idle", () => {
             if (timelineMapInstance.getZoom() > 14) timelineMapInstance.setZoom(14);
        });
    }, [timelineMapInstance, timelineReport, activeTab]);

    const onLoad = useCallback(function callback(map) {
        setMapInstance(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMapInstance(null);
    }, []);

    const onTimelineLoad = useCallback(function callback(map) {
        setTimelineMapInstance(map);
    }, []);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            if (activeTab !== "Dashboard") return;
            const token = getToken();
            if (!token) return;
            setDashboardLoading(true);
            try {
                const res = await axios.get(`/api/v1/reports/dashboard-stats?date=${dashboardDate}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setDashboardStats(res.data);
                }
            } catch (err) {
                console.error("Error fetching dashboard stats:", err);
            } finally {
                setDashboardLoading(false);
            }
        };
        fetchDashboardStats();
    }, [dashboardDate, activeTab]);

    const formatMinsToHrs = (mins) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return { h, m };
    };

    const onTimelineUnmount = useCallback(function callback(map) {
        setTimelineMapInstance(null);
    }, []);

    const changeTimelineDate = (days) => {
        const curr = new Date(timelineDate);
        curr.setDate(curr.getDate() + days);
        setTimelineDate(curr.toISOString().split("T")[0]);
    };

    const changeDashboardDate = (days) => {
        const curr = new Date(dashboardDate);
        curr.setDate(curr.getDate() + days);
        setDashboardDate(curr.toISOString().split("T")[0]);
    };

    // ─── Render functions ─────────────────────────────────────────────

    const renderDashboard = () => {
        const tableData = dashboardStats.data || [];
        const filteredData = tableData.filter(u => 
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (u.employeeId && u.employeeId.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        const summary = dashboardStats.summary || {};
        const sumMotion = formatMinsToHrs(summary.totalMotionTime || 0);
        const sumRest = formatMinsToHrs(summary.totalIdleTime || 0);
        const sumTotal = formatMinsToHrs(summary.totalTime || 0);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header & Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#111827' }}>Dashboard</h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                            <button onClick={() => changeDashboardDate(-1)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderRight: '1px solid #e5e7eb' }}>&lt;</button>
                            <input 
                                type="date" 
                                value={dashboardDate}
                                onChange={(e) => setDashboardDate(e.target.value)}
                                style={{ padding: '8px 16px', border: 'none', outline: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'inherit' }}
                            />
                            <button onClick={() => changeDashboardDate(1)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderLeft: '1px solid #e5e7eb' }}>&gt;</button>
                        </div>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                            <i className="ri-refresh-line"></i> Refresh
                        </button>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                            Download Report
                        </button>
                    </div>
                </div>

                {/* Top Summary Cards */}
                {dashboardLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading Dashboard Data...</div>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534', fontSize: '0.8rem', fontWeight: 600 }}>
                            Total Distance <i className="ri-route-line" style={{ fontSize: '1.2rem', color: '#10b981' }}></i>
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827' }}>{summary.totalDistance || "0.00"} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kms</span></div>
                    </div>
                    <div style={{ background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b21a8', fontSize: '0.8rem', fontWeight: 600 }}>
                            Total Time <i className="ri-time-line" style={{ fontSize: '1.2rem', color: '#8b5cf6' }}></i>
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827' }}>{sumTotal.h} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs</span> {sumTotal.m} <span style={{ fontSize: '1rem', fontWeight: 500 }}>mins</span></div>
                    </div>
                    <div style={{ background: '#fdf2f8', border: '1px solid #fce7f3', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9d174d', fontSize: '0.8rem', fontWeight: 600 }}>
                            Total Time Spent in Motion <i className="ri-run-line" style={{ fontSize: '1.2rem', color: '#ec4899' }}></i>
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827' }}>{sumMotion.h} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs</span> {sumMotion.m} <span style={{ fontSize: '1rem', fontWeight: 500 }}>mins</span></div>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600 }}>
                            Total Time Spent at Rest <i className="ri-hotel-bed-line" style={{ fontSize: '1.2rem', color: '#3b82f6' }}></i>
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827' }}>{sumRest.h} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs</span> {sumRest.m} <span style={{ fontSize: '1rem', fontWeight: 500 }}>mins</span></div>
                    </div>
                </div>
                )}

                {/* Table Section */}
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: '20px', minHeight: '400px' }}>
                    
                    {/* Filter and Search */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', width: '300px' }}>
                            <i className="ri-search-line" style={{ color: '#9ca3af', marginRight: '8px' }}></i>
                            <input 
                                type="text" 
                                placeholder="Search by name or staff ID" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.85rem' }} 
                            />
                        </div>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                            <i className="ri-filter-3-line"></i> Filter
                        </button>
                    </div>

                    {/* Data Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Name</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Status</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Total Distance</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Total Time</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Total time in motion</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 500 }}>Total time at rest</th>
                                </tr>
                            </thead>
                            {!dashboardLoading && (
                            <tbody>
                                {filteredData.map((user) => {
                                    const uMotion = formatMinsToHrs(user.motionTime || 0);
                                    const uRest = formatMinsToHrs(user.idleTime || 0);
                                    const uTotal = formatMinsToHrs(user.totalTime || 0);

                                    return (
                                        <tr key={user._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '16px', fontWeight: 700, color: '#2563eb', cursor: 'pointer' }}>{user.name.toUpperCase()}</td>
                                            <td style={{ padding: '16px', color: '#6b7280' }}>-</td>
                                            <td style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>{user.totalDistance > 0 ? `${user.totalDistance} kms` : '-'}</td>
                                            <td style={{ padding: '16px', color: '#374151' }}>{user.totalTime > 0 ? `${uTotal.h} hrs ${uTotal.m} mins` : '-'}</td>
                                            <td style={{ padding: '16px', color: '#374151' }}>{user.motionTime > 0 ? `${uMotion.h} hrs ${uMotion.m} mins` : '-'}</td>
                                            <td style={{ padding: '16px', color: '#374151' }}>{user.idleTime > 0 ? `${uRest.h} hrs ${uRest.m} mins` : '-'}</td>
                                        </tr>
                                    );
                                })}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>No tracking data found for the selected date or query.</td>
                                    </tr>
                                )}
                            </tbody>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderLiveTracking = () => (
        <div className="geo-map-container" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 160px)', borderRadius: '12px', overflow: 'hidden' }}>
            {isLoaded ? (
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={defaultPosition}
                    zoom={12}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                >
                    {window.google && (
                         <Marker
                         position={{ lat: 19.182755, lng: 72.969 }} 
                         icon={{
                             path: window.google.maps.SymbolPath.CIRCLE,
                             scale: 35,
                             fillColor: '#10b981', 
                             fillOpacity: 0.5,
                             strokeWeight: 0
                         }}
                     />
                    )}

                    {!selectedEmp && employees.map((emp) => (
                        <Marker
                            key={emp.id}
                            position={{ lat: emp.latitude, lng: emp.longitude }}
                            onClick={() => setSelectedEmp(emp)}
                            icon={{
                                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                scale: 5,
                                fillColor: '#000000', 
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 1,
                                rotation: Math.floor(Math.random() * 360) 
                            }}
                        />
                    ))}
                    {selectedEmp && (
                        <>
                            {userRoute && userRoute.length > 0 && (
                                <Polyline
                                    path={userRoute.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))}
                                    options={{ strokeColor: "#3b82f6", strokeOpacity: 0.85, strokeWeight: 4 }}
                                />
                            )}
                            <Marker
                                position={{ lat: selectedEmp.latitude, lng: selectedEmp.longitude }}
                                icon={{
                                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                    scale: 6,
                                    fillColor: '#10b981', 
                                    fillOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 1,
                                    rotation: 15
                                }}
                                onClick={() => setSelectedEmp(null)}
                            >
                                <InfoWindow position={{ lat: selectedEmp.latitude, lng: selectedEmp.longitude }} onCloseClick={() => setSelectedEmp(null)}>
                                    <div style={{ padding: '8px', minWidth: '150px' }}>
                                        <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{selectedEmp.name}</h4>
                                        <div style={{ fontSize: '0.85rem', color: '#555' }}>
                                            <p style={{ margin: '4px 0' }}><strong>Status:</strong> {selectedEmp.status}</p>
                                            <p style={{ margin: '4px 0' }}><strong>Battery:</strong> {selectedEmp.battery ? `${selectedEmp.battery}%` : 'N/A'}</p>
                                        </div>
                                    </div>
                                </InfoWindow>
                            </Marker>
                        </>
                    )}
                </GoogleMap>
            ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f3f4f6", color: "#6b7280" }}>
                    Loading Tracking Map...
                </div>
            )}
        </div>
    );

    const renderTimeline = () => {
        const selUserName = usersList.find(u => u._id === timelineUser)?.name || "Select User";
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', gap: '16px' }}>
                {/* Timeline Top Controls */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                        <select 
                            value={timelineUser}
                            onChange={(e) => setTimelineUser(e.target.value)}
                            style={{ padding: '8px 16px', border: 'none', outline: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', minWidth: '220px' }}
                        >
                            <option value="">-- Employee --</option>
                            {usersList.map((usr) => (
                                <option key={usr._id} value={usr._id}>{usr.name.toUpperCase()} {usr.employeeId ? `(${usr.employeeId})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                        <button onClick={() => changeTimelineDate(-1)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderRight: '1px solid #e5e7eb' }}>&lt;</button>
                        <input 
                            type="date" 
                            value={timelineDate}
                            onChange={(e) => setTimelineDate(e.target.value)}
                            style={{ padding: '8px 16px', border: 'none', outline: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'inherit' }}
                        />
                        <button onClick={() => changeTimelineDate(1)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderLeft: '1px solid #e5e7eb' }}>&gt;</button>
                    </div>
                </div>

                {/* Timeline Split Layout */}
                <div style={{ display: 'flex', flex: 1, gap: '16px', overflow: 'hidden' }}>
                    
                    {/* Left Sidebar */}
                    <div style={{ width: '320px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#111827' }}>Timeline</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ width: '30px', height: '16px', background: '#10b981', borderRadius: '16px', position: 'relative' }}>
                                    <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px' }}></div>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Activity</span>
                            </div>
                        </div>
                        
                        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <i className="ri-user-line" style={{ color: '#9ca3af' }}></i>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>{selUserName}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#6b7280' }}>
                                <span>{new Date(timelineDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} <span style={{background: '#e5e7eb', padding:'2px 6px', borderRadius:'4px', marginLeft:'4px'}}>Asia/Kolkata</span></span>
                                <div>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>{timelineReport ? timelineReport.totalDistance : "0.00"} km</span>
                                    <span style={{ color: '#10b981', fontWeight: 600, marginLeft: '6px' }}>{timelineReport ? `${Math.floor(timelineReport.motionTime/60)}h ${timelineReport.motionTime%60}m` : "0h 0m"}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px 0' }}>
                            {timelineLoading && <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading timeline...</p>}
                            {!timelineLoading && timelineEvents.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '0.85rem' }}>No tracking data found for this date.</p>}
                            
                            {!timelineLoading && timelineEvents.map((evt, idx) => (
                                <div key={idx} style={{ display: 'flex', marginBottom: '24px', position: 'relative' }}>
                                    {/* Line connecting items */}
                                    {idx !== timelineEvents.length - 1 && (
                                        <div style={{ position: 'absolute', left: '72px', top: '24px', bottom: '-24px', width: '2px', background: '#e5e7eb', zIndex: 1 }}></div>
                                    )}
                                    
                                    <div style={{ width: '60px', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280', paddingTop: '4px' }}>
                                        {new Date(evt.time).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <div style={{ width: '26px', display: 'flex', justifyContent: 'center', zIndex: 2, paddingTop: '4px' }}>
                                        {evt.type === 'Start' ? (
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', border: '2px solid #3b82f6' }}></div>
                                        ) : evt.type === 'Stop' ? (
                                            <i className="ri-stop-circle-line" style={{ color: '#ef4444', background: '#fff', fontSize: '1rem', lineHeight: '12px' }}></i>
                                        ) : (
                                            <i className="ri-steering-2-line" style={{ color: '#6b7280', background: '#fff', fontSize: '1rem', lineHeight: '12px' }}></i>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, paddingTop: '2px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
                                                {evt.type === 'Start' ? 'Tracking Started' : evt.type}
                                            </span>
                                            {evt.type === 'Drive' && (
                                                <span style={{ fontSize: '0.75rem', color: '#111827', fontWeight: 600 }}>{evt.dummyKm} km <span style={{ color: '#10b981' }}>{evt.dummyMin}m</span></span>
                                            )}
                                            {evt.type === 'Stop' && (
                                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{evt.duration}m</span>
                                            )}
                                        </div>
                                        {evt.address && (
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px', lineHeight: '1.4' }}>
                                                {evt.address}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Map */}
                    <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' }}>
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={containerStyle}
                                center={defaultPosition}
                                zoom={12}
                                onLoad={onTimelineLoad}
                                onUnmount={onTimelineUnmount}
                            >
                                {timelineReport && timelineReport.route && timelineReport.route.length > 0 && (
                                    <>
                                        <Polyline
                                            path={timelineReport.route.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))}
                                            options={{ strokeColor: "#000000", strokeOpacity: 0.8, strokeWeight: 3 }}
                                        />
                                        <Marker
                                            position={{ lat: Number(timelineReport.route[0].lat), lng: Number(timelineReport.route[0].lng) }}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: 6,
                                                fillColor: '#000000',
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 2,
                                            }}
                                            label={{ text: "S", color: "white", fontSize: "9px", fontWeight: "bold" }}
                                        />
                                        <Marker
                                            position={{ lat: Number(timelineReport.route[timelineReport.route.length-1].lat), lng: Number(timelineReport.route[timelineReport.route.length-1].lng) }}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: 6,
                                                fillColor: '#000000',
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 2,
                                            }}
                                        />
                                    </>
                                )}
                            </GoogleMap>
                        ) : (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f3f4f6", color: "#6b7280" }}>
                                Loading Timeline Map...
                            </div>
                        )}

                        {/* Bottom Playback Bar overlay */}
                        <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', background: 'rgba(255,255,255,0.95)', padding: '12px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                            <i className="ri-list-check" style={{ color: '#9ca3af', cursor: 'pointer' }}></i>
                            <i className="ri-play-circle-line" style={{ color: '#10b981', fontSize: '1.4rem', cursor: 'pointer' }}></i>
                            <div style={{ flex: 1, height: '4px', background: '#e5e7eb', borderRadius: '2px', position: 'relative' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', background: '#3b82f6', borderRadius: '2px' }}></div>
                                <div style={{ position: 'absolute', left: '30%', top: '-4px', width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', border: '2px solid white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}></div>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                                {timelineReport && timelineReport.route.length > 0 ? new Date(timelineReport.route[Math.floor(timelineReport.route.length*0.3)].time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : '00:00 AM'}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>1X <i className="ri-arrow-down-s-line"></i></span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="geo-dashboard-layout" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            {/* Top Tabs */}
            <div className="geo-tabs" style={{ display: 'flex', gap: '8px', background: '#fdfdfd', borderBottom: '1px solid #e5e7eb', padding: '8px 16px 0 16px', borderRadius: '12px 12px 0 0' }}>
                {tabs.map(tab => (
                    <button 
                        key={tab} 
                        className={`geo-tab-button ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '12px 20px',
                            background: activeTab === tab ? '#ffffff' : 'transparent',
                            color: activeTab === tab ? '#2563eb' : '#6b7280',
                            border: 'none',
                            borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                            fontWeight: activeTab === tab ? '600' : '500',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="geo-tab-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {activeTab === "Dashboard" && renderDashboard()}
                {activeTab === "Live Tracking" && renderLiveTracking()}
                {activeTab === "Timeline" && renderTimeline()}
                
                {activeTab !== "Dashboard" && activeTab !== "Live Tracking" && activeTab !== "Timeline" && (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280', background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <i className="ri-tools-line" style={{ fontSize: '2.5rem', marginBottom: '12px', display: 'inline-block', color: '#9ca3af' }}></i>
                        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>{activeTab} module</h3>
                        <p style={{ margin: 0 }}>This section layout is reserved based on the design references.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeoDashboard;
