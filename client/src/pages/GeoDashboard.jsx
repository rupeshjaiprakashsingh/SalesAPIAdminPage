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

// Helper to remove spiderweb jitter visually
const calcDistMeters = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371e3; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
};

const getSmoothedPath = (route) => {
    if (!route || route.length === 0) return [];
    const validRoute = route.filter(p => p.lat != null && p.lng != null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)));
    if (validRoute.length === 0) return [];

    const smoothed = [{ lat: Number(validRoute[0].lat), lng: Number(validRoute[0].lng), time: validRoute[0].time }];
    for (let i = 1; i < validRoute.length; i++) {
        const pt = validRoute[i];
        const last = smoothed[smoothed.length - 1];
        const lat = Number(pt.lat), lng = Number(pt.lng);
        const dist = calcDistMeters(last.lat, last.lng, lat, lng);

        if (pt.time && last.time) {
            const elapsedSec = (new Date(pt.time) - new Date(last.time)) / 1000;
            if (elapsedSec > 0 && dist / elapsedSec > 42) continue; // ~150 km/h max
        }

        if (dist > 25) { // 25m threshold
            smoothed.push({ lat, lng, time: pt.time });
        }
    }
    const lastPt = validRoute[validRoute.length - 1];
    const lastSmoothed = smoothed[smoothed.length - 1];
    if (lastSmoothed.lat !== Number(lastPt.lat) || lastSmoothed.lng !== Number(lastPt.lng)) {
        smoothed.push({ lat: Number(lastPt.lat), lng: Number(lastPt.lng), time: lastPt.time });
    }
    return smoothed;
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
    const [timelineSearch, setTimelineSearch] = useState("");
    const [isTimelineDropdownOpen, setIsTimelineDropdownOpen] = useState(false);
    
    // Playback logic states
    const [playbackState, setPlaybackState] = useState({
        isPlaying: false,
        speed: 1,
        currentIndex: 0
    });

    const smoothedTimelinePath = React.useMemo(() => {
        if (!timelineReport || !timelineReport.route || timelineReport.route.length === 0) return [];
        return getSmoothedPath(timelineReport.route);
    }, [timelineReport]);

    useEffect(() => {
        setPlaybackState({ isPlaying: false, speed: 1, currentIndex: 0 });
    }, [timelineReport]);

    useEffect(() => {
        let timer;
        if (playbackState.isPlaying && smoothedTimelinePath.length > 0) {
            timer = setInterval(() => {
                setPlaybackState(prev => {
                    let maxIdx = smoothedTimelinePath.length - 1;
                    if (prev.currentIndex >= maxIdx) {
                        return { ...prev, isPlaying: false };
                    }
                    let nextIdx = prev.currentIndex + prev.speed;
                    if (nextIdx > maxIdx) nextIdx = maxIdx;
                    return { ...prev, currentIndex: nextIdx };
                });
            }, 300);
        }
        return () => clearInterval(timer);
    }, [playbackState.isPlaying, playbackState.speed, smoothedTimelinePath.length]);

    useEffect(() => {
        if (playbackState.isPlaying && timelineMapInstance && smoothedTimelinePath.length > 0) {
            const pt = smoothedTimelinePath[playbackState.currentIndex];
            if (pt) timelineMapInstance.panTo({lat: pt.lat, lng: pt.lng});
        }
    }, [playbackState.currentIndex, playbackState.isPlaying, timelineMapInstance, smoothedTimelinePath]);

    // ─── Dashboard Tab State ──────────────────────────────────────
    const [dashboardDate, setDashboardDate] = useState(todayStr);
    const [searchQuery, setSearchQuery] = useState("");
    const [dashboardStats, setDashboardStats] = useState({ summary: {}, data: [] });
    const [dashboardLoading, setDashboardLoading] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, 
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
                                endTime: stop.endTime,
                                duration: stop.duration,
                                address: stop.address || "Unknown Location",
                                lat: stop.latitude,
                                lng: stop.longitude
                            });
                        });
                    }
                    
                    for (let i = 1; i < report.route.length; i++) {
                        const prev = report.route[i-1];
                        const curr = report.route[i];
                        const diffMins = (new Date(curr.time) - new Date(prev.time)) / 60000;
                        
                        if (diffMins > 10) { 
                            events.push({
                                type: "Outage",
                                time: prev.time,
                                endTime: curr.time,
                                durationMin: Math.round(diffMins),
                                message: "Location services disabled" 
                            });
                        }
                    }
                    
                    events.sort((a,b) => new Date(a.time) - new Date(b.time));
                    
                    let finalEvents = [];
                    const calcDist = (lat1, lon1, lat2, lon2) => {
                        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
                        const R = 6371;
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLon = (lon2 - lon1) * Math.PI / 180;
                        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    };

                    const getDriveStats = (startTime, endTime) => {
                         let distKm = 0;
                         let driveEndPt = null;
                         for (let pt of report.route) {
                             const ptTime = new Date(pt.time);
                             if (ptTime >= new Date(startTime) && ptTime <= new Date(endTime)) {
                                  if (driveEndPt) {
                                      distKm += calcDist(driveEndPt.lat, driveEndPt.lng, pt.lat, pt.lng);
                                  }
                                  driveEndPt = pt;
                             }
                         }
                         const durationMin = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
                         return { distKm: distKm.toFixed(2), durationMin };
                    };

                    for (let i = 0; i < events.length; i++) {
                        finalEvents.push(events[i]);
                        
                        if (i < events.length - 1) {
                             let nextEvent = events[i+1];
                             let driveStartTime = events[i].endTime || events[i].time;
                             let driveEndTime = nextEvent.time;
                             
                             let { distKm, durationMin } = getDriveStats(driveStartTime, driveEndTime);
                             
                             if (durationMin > 0) {
                                 finalEvents.push({
                                     type: "Drive",
                                     time: driveStartTime,
                                     distanceKm: distKm,
                                     durationMin: durationMin
                                 });
                             }
                        }
                    }
                    setTimelineEvents(finalEvents);
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

    const formatTimeStr = (mins) => {
        if (!mins || isNaN(mins)) return "0 hrs 0 mins";
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return `${h} hrs ${m} mins`;
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
        const todayData = dashboardStats.data || [];
        const summary = dashboardStats.summary || {};

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Header Row: Title & Action Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Dashboard</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', gap: '10px' }}>
                            <i className="ri-arrow-left-s-line" style={{ cursor: 'pointer', color: '#6b7280' }} onClick={() => changeDashboardDate(-1)}></i>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', minWidth: '100px', textAlign: 'center' }}>
                                {new Date(dashboardDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <i className="ri-arrow-right-s-line" style={{ cursor: 'pointer', color: '#6b7280' }} onClick={() => changeDashboardDate(1)}></i>
                            <i className="ri-calendar-line" style={{ color: '#3b82f6', marginLeft: '4px' }}></i>
                        </div>
                        <button 
                            onClick={() => setDashboardDate(prev => prev + "")}
                            style={{ width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
                        >
                            <i className="ri-refresh-line"></i>
                        </button>
                        <button style={{ height: '36px', padding: '0 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ri-download-2-line"></i> Download Report
                        </button>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ background: '#f4fdf8', border: '1px solid #e5ffe7', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Total Distance</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{summary.totalDistance || "0"} kms</div>
                        <i className="ri-route-line" style={{ position: 'absolute', right: '16px', top: '16px', fontSize: '1.2rem', color: '#10b981' }}></i>
                    </div>
                    <div style={{ background: '#fcfaff', border: '1px solid #f6f0ff', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Total Time</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{formatTimeStr(summary.totalTime)}</div>
                        <i className="ri-time-line" style={{ position: 'absolute', right: '16px', top: '16px', fontSize: '1.2rem', color: '#8b5cf6' }}></i>
                    </div>
                    <div style={{ background: '#fffcfc', border: '1px solid #fff0f5', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
                            <span>Total Time</span>
                            <span style={{fontSize: '0.7rem', fontWeight: 400, color: '#6b7280'}}>Spent in Motion</span>
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{formatTimeStr(summary.totalMotionTime)}</div>
                        <i className="ri-pin-distance-line" style={{ position: 'absolute', right: '16px', top: '16px', fontSize: '1.2rem', color: '#d946ef' }}></i>
                    </div>
                    <div style={{ background: '#f8fbff', border: '1px solid #eff6ff', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
                            <span>Total Time</span>
                            <span style={{fontSize: '0.7rem', fontWeight: 400, color: '#6b7280'}}>Spent in Rest</span>
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{formatTimeStr(summary.totalIdleTime)}</div>
                        <i className="ri-history-line" style={{ position: 'absolute', right: '16px', top: '16px', fontSize: '1.2rem', color: '#3b82f6' }}></i>
                    </div>
                </div>

                {/* Tracking Data Table Card */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    
                    {/* Toolbar */}
                    <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0 12px', width: '300px' }}>
                                <i className="ri-search-line" style={{ color: '#9ca3af', fontSize: '1rem' }}></i>
                                <input 
                                    type="text" 
                                    placeholder="Search by name or staff ID"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', padding: '10px 8px', fontSize: '0.85rem', width: '100%', color: '#374151' }}
                                />
                            </div>
                            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', height: '38px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem', color: '#374151', cursor: 'pointer' }}>
                                <i className="ri-filter-3-line" style={{ color: '#3b82f6' }}></i> Filter
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#fdfdfd', borderBottom: '1px solid #f3f4f6' }}>
                                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Name</th>
                                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Total Distance</th>
                                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Total Time</th>
                                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Total Time In Motion</th>
                                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Total Time At Rest</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboardLoading ? (
                                    <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Fetching dashboard data...</td></tr>
                                ) : (todayData.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) ? (
                                    <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No tracking data found for this date</td></tr>
                                ) : todayData.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map((u, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f9fafb' }}>
                                        <td style={{ padding: '14px 20px' }}>
                                            <div 
                                                style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer' }}
                                                onClick={() => {
                                                    setTimelineUser(u._id);
                                                    setTimelineDate(dashboardDate);
                                                    setActiveTab("Timeline");
                                                }}
                                            >
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase' }} title="View Timeline">{u.name}</span>
                                                {u.employeeId && <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{u.employeeId}</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 20px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: (u.totalDistance > 0) ? '#10b981' : '#eab308' }}>
                                                {(u.totalDistance > 0) ? 'Traveled' : 'Not Traveled'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 20px', fontSize: '0.85rem', color: '#4b5563' }}>{Number(u.totalDistance || 0).toFixed(1)} kms</td>
                                        <td style={{ padding: '14px 20px', fontSize: '0.85rem', color: '#4b5563' }}>{formatTimeStr(u.totalTime)}</td>
                                        <td style={{ padding: '14px 20px', fontSize: '0.85rem', color: '#4b5563' }}>{formatTimeStr(u.motionTime)}</td>
                                        <td style={{ padding: '14px 20px', fontSize: '0.85rem', color: '#4b5563' }}>{formatTimeStr(u.idleTime)}</td>
                                    </tr>
                                ))}
                            </tbody>
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
                            {userRoute && userRoute.length > 0 && (() => {
                                const validPath = userRoute
                                    .map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))
                                    .filter(p => !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0);
                                return validPath.length > 1 ? (
                                    <Polyline
                                        path={validPath}
                                        options={{ strokeColor: "#3b82f6", strokeOpacity: 0.85, strokeWeight: 4 }}
                                    />
                                ) : null;
                            })()}
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
        
        // Helper and getSmoothedPath elevated to global scope

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', gap: '16px' }}>
                {/* Timeline Top Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <div 
                                onClick={() => setIsTimelineDropdownOpen(!isTimelineDropdownOpen)}
                                style={{ border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', padding: '10px 16px', cursor: 'pointer', minWidth: '300px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                            >
                                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#111827' }}>
                                    {timelineUser ? (usersList.find(u => u._id === timelineUser)?.name.toUpperCase() + (usersList.find(u => u._id === timelineUser)?.employeeId ? ` (${usersList.find(u => u._id === timelineUser)?.employeeId})` : "")) : "-- Select Staff --"}
                                </span>
                                <i className={`ri-arrow-${isTimelineDropdownOpen ? 'up' : 'down'}-s-line`} style={{color: '#9ca3af', fontSize: '1.2rem'}}></i>
                            </div>

                            {isTimelineDropdownOpen && (
                                <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', zIndex: 100, maxHeight: '340px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', borderRadius: '8px 8px 0 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 12px' }}>
                                            <i className="ri-search-line" style={{ color: '#9ca3af', fontSize: '1rem', marginRight: '8px' }}></i>
                                            <input 
                                                autoFocus
                                                type="text" 
                                                placeholder="Search by name or staff ID"
                                                value={timelineSearch}
                                                onChange={(e) => setTimelineSearch(e.target.value)}
                                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.85rem', color: '#374151' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                                        {usersList.filter(u => `${u.name} ${u.employeeId || ""}`.toLowerCase().includes(timelineSearch.toLowerCase())).map(usr => (
                                            <div 
                                                key={usr._id} 
                                                onClick={() => { setTimelineUser(usr._id); setIsTimelineDropdownOpen(false); setTimelineSearch(""); }}
                                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: timelineUser === usr._id ? '#f8fafc' : '#fff' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                                onMouseOut={(e) => e.currentTarget.style.background = timelineUser === usr._id ? '#f8fafc' : '#fff'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: timelineUser === usr._id ? '#3b82f6' : 'transparent' }}></div>
                                                    <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{usr.name.toUpperCase()} <span style={{ color: '#6b7280', fontWeight: 400 }}>{usr.employeeId ? `(${usr.employeeId})` : ""}</span></span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#eab308' }}>Not Traveled</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', background: '#fff', color: '#4b5563' }}>
                            <button onClick={() => changeTimelineDate(-1)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderRight: '1px solid #e5e7eb', color: '#6b7280' }}>&lt;</button>
                            <input 
                                type="date" 
                                value={timelineDate}
                                onChange={(e) => setTimelineDate(e.target.value)}
                                style={{ padding: '8px 16px', border: 'none', outline: 'none', background: 'transparent', fontWeight: '600', fontSize: '0.85rem', fontFamily: 'inherit', color: '#374151' }}
                            />
                            <button onClick={() => changeTimelineDate(1)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', color: '#6b7280' }}>&gt;</button>
                            <button style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <i className="ri-calendar-line"></i>
                            </button>
                        </div>
                    </div>

                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#ffffff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
                        <i className="ri-share-line"></i> Share
                    </button>
                </div>

                {/* Timeline Split Layout */}
                <div style={{ display: 'flex', flex: 1, gap: '16px', overflow: 'hidden' }}>
                    
                    {/* Left Sidebar */}
                    <div style={{ width: '300px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>Timeline</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ width: '36px', height: '20px', background: '#10b981', borderRadius: '20px', position: 'relative', cursor: 'pointer' }}>
                                    <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px' }}></div>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Activity</span>
                            </div>
                        </div>
                        
                        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <i className="ri-user-3-line" style={{ color: '#9ca3af', fontSize: '1rem' }}></i>
                                <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase' }}>{selUserName}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                                <span>{new Date(timelineDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} <span style={{background: '#e5e7eb', padding:'2px 6px', borderRadius:'4px', marginLeft:'4px', fontSize: '0.7rem', color: '#374151'}}>Asia/Kolkata</span></span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600, color: '#6b7280' }}>{timelineReport ? timelineReport.totalDistance : "0.00"} km</span>
                                    <span style={{ color: '#10b981', fontWeight: 600 }}>{timelineReport ? `${Math.floor(timelineReport.motionTime/60)}h ${timelineReport.motionTime%60}m` : "0h 0m"}</span>
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
                                        <div style={{ position: 'absolute', left: '72px', top: '24px', bottom: '-24px', width: '1px', background: '#d1d5db', zIndex: 1 }}></div>
                                    )}
                                    
                                    <div style={{ width: '60px', textAlign: 'right', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, paddingTop: '1px' }}>
                                        {new Date(evt.time).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <div style={{ width: '26px', display: 'flex', justifyContent: 'center', zIndex: 2 }}>
                                        {evt.type === 'Start' ? (
                                            <i className="ri-focus-3-line" style={{ color: '#6b7280', background: '#fff', fontSize: '1.2rem', marginTop: '-2px' }}></i>
                                        ) : evt.type === 'Stop' ? (
                                            <i className="ri-hourglass-2-line" style={{ color: '#6b7280', background: '#fff', fontSize: '1.1rem', marginTop: '-1px' }}></i>
                                        ) : evt.type === 'Outage' ? (
                                            <i className="ri-cloud-off-line" style={{ color: '#ef4444', background: '#fff', fontSize: '1.2rem', marginTop: '-2px' }}></i>
                                        ) : (
                                            <i className="ri-steering-2-line" style={{ color: '#6b7280', background: '#fff', fontSize: '1.2rem', marginTop: '-2px' }}></i>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, paddingLeft: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: evt.type === 'Outage' ? '#ef4444' : '#111827' }}>
                                                {evt.type === 'Start' ? 'Tracking Started' : evt.type}
                                            </span>
                                            {evt.type === 'Drive' && (
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#111827', fontWeight: 600 }}>{evt.distanceKm} km</span>
                                                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>
                                                        {evt.durationMin >= 60 ? `${Math.floor(evt.durationMin/60)}h ${evt.durationMin%60}m` : `${evt.durationMin}m`}
                                                    </span>
                                                </div>
                                            )}
                                            {evt.type === 'Stop' && (
                                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                                    {evt.duration >= 60 ? `${Math.floor(evt.duration/60)}h ${evt.duration%60}m` : `${evt.duration}m`}
                                                </span>
                                            )}
                                            {evt.type === 'Outage' && (
                                                <span style={{ fontSize: '0.75rem', color: '#111827', fontWeight: 600 }}>
                                                    {evt.durationMin >= 60 ? `${Math.floor(evt.durationMin/60)}h ${evt.durationMin%60}m` : `${evt.durationMin}m`}
                                                </span>
                                            )}
                                        </div>
                                        {evt.address && evt.type === 'Stop' && (
                                            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '6px', lineHeight: '1.4' }}>
                                                {evt.address}
                                            </div>
                                        )}
                                        {evt.type === 'Outage' && evt.message && (
                                            <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '6px', lineHeight: '1.4', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                {evt.message} <i className="ri-error-warning-line" style={{marginLeft: '4px'}}></i>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Map */}
                    <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' }}>
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={containerStyle}
                                center={defaultPosition}
                                zoom={12}
                                onLoad={onTimelineLoad}
                                onUnmount={onTimelineUnmount}
                                options={{
                                    mapTypeControl: false,
                                    streetViewControl: false,
                                    fullscreenControl: false,
                                    zoomControl: false
                                }}
                            >
                                {smoothedTimelinePath.length > 1 && (
                                    <>
                                        <Polyline
                                            path={smoothedTimelinePath}
                                            options={{ strokeColor: "#111827", strokeOpacity: 0.9, strokeWeight: 2 }}
                                        />
                                        <Marker
                                            position={{ lat: smoothedTimelinePath[0].lat, lng: smoothedTimelinePath[0].lng }}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: 5,
                                                fillColor: '#111827',
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 2,
                                            }}
                                            label={{ text: "S", color: "white", fontSize: "8px", fontWeight: "bold", className: 'marker-label-offset' }}
                                        />
                                        <Marker
                                            position={{ lat: smoothedTimelinePath[smoothedTimelinePath.length-1].lat, lng: smoothedTimelinePath[smoothedTimelinePath.length-1].lng }}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: 5,
                                                fillColor: '#111827',
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 2,
                                            }}
                                        />
                                        <Marker
                                            position={{ lat: smoothedTimelinePath[playbackState.currentIndex]?.lat || 0, lng: smoothedTimelinePath[playbackState.currentIndex]?.lng || 0 }}
                                            icon={{
                                                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                                scale: 7,
                                                fillColor: '#10b981', 
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 1,
                                                rotation: playbackState.currentIndex > 0 
                                                    ? window.google?.maps?.geometry?.spherical?.computeHeading(
                                                        new window.google.maps.LatLng(smoothedTimelinePath[playbackState.currentIndex - 1].lat, smoothedTimelinePath[playbackState.currentIndex - 1].lng),
                                                        new window.google.maps.LatLng(smoothedTimelinePath[playbackState.currentIndex].lat, smoothedTimelinePath[playbackState.currentIndex].lng)
                                                      ) || 0 
                                                    : 0
                                            }}
                                            zIndex={100}
                                        />
                                    </>
                                )}
                            </GoogleMap>
                        ) : (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f3f4f6", color: "#6b7280" }}>
                                Loading Timeline Map...
                            </div>
                        )}

                        {/* Map controls floating */}
                        <div style={{ position: 'absolute', right: '16px', top: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}>
                                <i className="ri-stack-line" style={{ fontSize: '1.2rem' }}></i>
                            </button>
                            <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}>
                                <i className="ri-fullscreen-line" style={{ fontSize: '1.2rem' }}></i>
                            </button>
                        </div>
                        <div style={{ position: 'absolute', right: '16px', bottom: '80px', display: 'flex', flexDirection: 'column', gap: '0', background: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                            <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}>
                                <i className="ri-add-line" style={{ fontSize: '1.4rem' }}></i>
                            </button>
                            <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}>
                                <i className="ri-subtract-line" style={{ fontSize: '1.4rem' }}></i>
                            </button>
                        </div>

                        {/* Bottom Playback Bar overlay */}
                        <div style={{ position: 'absolute', bottom: '24px', left: '24px', width: '380px', background: 'rgba(255,255,255,0.95)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                            <i className="ri-barcode-line" style={{ color: '#9ca3af', cursor: 'pointer', transform: 'rotate(90deg)', fontSize: '1.1rem' }}></i>
                            <i 
                                className={playbackState.isPlaying ? "ri-pause-circle-line" : "ri-play-circle-line"} 
                                style={{ color: '#10b981', fontSize: '1.4rem', cursor: 'pointer' }}
                                onClick={() => {
                                    if (playbackState.currentIndex >= smoothedTimelinePath.length - 1) {
                                        setPlaybackState(p => ({ ...p, currentIndex: 0, isPlaying: true }));
                                    } else {
                                        setPlaybackState(p => ({ ...p, isPlaying: !p.isPlaying }));
                                    }
                                }}
                            ></i>
                            <input 
                                type="range" 
                                min="0" 
                                max={Math.max(0, smoothedTimelinePath.length - 1)} 
                                value={playbackState.currentIndex}
                                onChange={(e) => setPlaybackState(p => ({ ...p, currentIndex: parseInt(e.target.value) }))}
                                style={{ flex: 1, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', minWidth: '60px', textAlign: 'right' }}>
                                {smoothedTimelinePath.length > 0 ? new Date(smoothedTimelinePath[playbackState.currentIndex].time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                            </span>
                            <span 
                                style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => setPlaybackState(p => ({ ...p, speed: p.speed === 1 ? 2 : p.speed === 2 ? 4 : 1 }))}
                            >
                                {playbackState.speed}X <i className="ri-arrow-down-s-line" style={{ marginLeft: '2px' }}></i>
                            </span>
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
