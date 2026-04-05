import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { GoogleMap, Marker, Polyline, Circle } from "@react-google-maps/api";
import { getToken, getSmoothedPath, containerStyle, defaultPosition } from "./geoUtils";

const TimelineTab = ({ isLoaded, onNavigateToDashboard }) => {
    const todayStr = new Date().toISOString().split("T")[0];

    const [usersList, setUsersList] = useState([]);
    const [timelineUser, setTimelineUser] = useState("");
    const [timelineDate, setTimelineDate] = useState(todayStr);
    const [timelineReport, setTimelineReport] = useState(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineMapInstance, setTimelineMapInstance] = useState(null);
    const [timelineEvents, setTimelineEvents] = useState([]);
    const [dashboardStats, setDashboardStats] = useState([]);
    const [timelineSearch, setTimelineSearch] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeTimelineEvent, setActiveTimelineEvent] = useState(null);
    const [playbackState, setPlaybackState] = useState({ isPlaying: false, speed: 1, currentIndex: 0 });
    const [liveLocation, setLiveLocation] = useState(null);

    // ─── Live Location Sync for Today's Timeline ─────────────────────────────
    const fetchLiveLocation = useCallback(async () => {
        if (!timelineUser || timelineDate !== todayStr) {
            setLiveLocation(null);
            return;
        }
        const token = getToken();
        if (!token) return;
        try {
            const res = await axios.get("/api/v1/attendance/live-locations", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                const live = res.data.data.find(u => String(u.userId) === String(timelineUser));
                if (live && live.latitude && live.longitude) {
                    setLiveLocation(live);
                }
            }
        } catch (err) {
            console.error("Error fetching live location for timeline:", err);
        }
    }, [timelineUser, timelineDate, todayStr]);

    useEffect(() => {
        fetchLiveLocation();
        if (timelineDate === todayStr) {
            const interval = setInterval(fetchLiveLocation, 10000);
            return () => clearInterval(interval);
        }
    }, [fetchLiveLocation, timelineDate, todayStr]);

    // ─── Live Geocoding Fallback (If Backend Address missing) ────────────────
    useEffect(() => {
        if (!isLoaded || !liveLocation || liveLocation.address || !window.google?.maps?.Geocoder) return;
        
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: Number(liveLocation.latitude), lng: Number(liveLocation.longitude) } }, (results, status) => {
            if (status === "OK" && results[0]) {
                const addr = results[0].formatted_address;
                setLiveLocation(prev => ({ ...prev, address: addr }));
                
                // Save to backend once
                const token = getToken();
                axios.put("/api/v1/location/address", {
                    employeeId: timelineUser,
                    lat: liveLocation.latitude,
                    lng: liveLocation.longitude,
                    address: addr
                }, { headers: { Authorization: `Bearer ${token}` } }).catch(e => console.error("Error saving live geocode:", e));
            }
        });
    }, [liveLocation?.latitude, liveLocation?.longitude, isLoaded, timelineUser]);


    // ─── Derived data ───────────────────────────────────────────────────────
    const fullRoutePath = React.useMemo(() => {
        if (!timelineReport?.route?.length) return [];
        return timelineReport.route
            .filter(p => p.lat != null && p.lng != null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)))
            .map(p => ({ lat: Number(p.lat), lng: Number(p.lng), time: p.time }));
    }, [timelineReport]);

    const routeSegments = React.useMemo(() => {
        if (!fullRoutePath.length) return [];
        const segments = [];
        let currentSegment = [fullRoutePath[0]];
        for (let i = 1; i < fullRoutePath.length; i++) {
            const prev = fullRoutePath[i - 1];
            const curr = fullRoutePath[i];
            const diffMins = (new Date(curr.time) - new Date(prev.time)) / 60000;
            if (diffMins > 10) {
                segments.push(currentSegment);
                currentSegment = [curr];
            } else {
                currentSegment.push(curr);
            }
        }
        if (currentSegment.length > 0) segments.push(currentSegment);
        return segments;
    }, [fullRoutePath]);

    const smoothedTimelinePath = React.useMemo(() => {
        if (!timelineReport?.route?.length) return [];
        return getSmoothedPath(timelineReport.route);
    }, [timelineReport]);

    // ─── Fetch users list ───────────────────────────────────────────────────
    useEffect(() => {
        const fetchUsers = async () => {
            const token = getToken();
            if (!token) return;
            try {
                const res = await axios.get("/api/v1/users?limit=1000", { headers: { Authorization: `Bearer ${token}` } });
                setUsersList(res.data.users || []);
            } catch (err) { console.error("Error fetching users:", err); }
        };
        fetchUsers();
    }, []);

    // Set default user / Handle Dashboard Navigation Link
    useEffect(() => {
        if (usersList.length > 0) {
            const savedUserId = sessionStorage.getItem("geo_timeline_userId");
            const savedDate = sessionStorage.getItem("geo_timeline_date");
            
            if (savedUserId && savedDate) {
                setTimelineUser(savedUserId);
                setTimelineDate(savedDate);
                // Clear out of session storage so it doesn't trigger on every mount forever
                sessionStorage.removeItem("geo_timeline_userId");
                sessionStorage.removeItem("geo_timeline_date");
            } else if (!timelineUser) {
                setTimelineUser(usersList[0]._id);
            }
        }
    }, [usersList]);

    // Fetch dashboard stats for the selected date to populate the dropdown status
    useEffect(() => {
        const fetchStats = async () => {
            const token = getToken();
            if (!token) return;
            try {
                const res = await axios.get(`/api/v1/reports/dashboard-stats?date=${timelineDate}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data && res.data.data) {
                    setDashboardStats(res.data.data);
                }
            } catch (err) {
                console.error("Error fetching dashboard stats for dropdown:", err);
            }
        };
        fetchStats();
    }, [timelineDate]);

    // ─── Fetch timeline report ──────────────────────────────────────────────
    useEffect(() => {
        let isCurrent = true;
        const fetchTimelineReport = async () => {
            if (!timelineUser) return;
            setTimelineReport(null);
            setTimelineEvents([]);
            setActiveTimelineEvent(null);
            const token = getToken();
            setTimelineLoading(true);
            try {
                const res = await axios.get(
                    `/api/v1/reports/timeline-report?userId=${timelineUser}&date=${timelineDate}&_t=${Date.now()}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!isCurrent) return;
                const report = res.data.data;
                setTimelineReport(report);

                let events = [];
                if (report?.route?.length > 0) {
                    events.push({ id: 'evt-start', type: "Start", time: report.route[0].time, label: "Tracking Started", lat: report.route[0].lat, lng: report.route[0].lng });

                    if (report.stopDetails) {
                        report.stopDetails.forEach((stop, i) => {
                            events.push({ id: `evt-stop-${i}`, type: "Stop", time: stop.startTime, endTime: stop.endTime, duration: stop.duration, address: stop.address || "Unknown Location", lat: stop.latitude, lng: stop.longitude });
                        });
                    }

                    for (let i = 1; i < report.route.length; i++) {
                        const prev = report.route[i - 1];
                        const curr = report.route[i];
                        const diffMins = (new Date(curr.time) - new Date(prev.time)) / 60000;
                        if (diffMins > 10) {
                            events.push({ id: `evt-outage-${i}`, type: "Outage", time: prev.time, endTime: curr.time, durationMin: Math.round(diffMins), message: "Location services disabled" });
                        }
                    }

                    if (report.punches) {
                        report.punches.forEach((punch, i) => {
                            events.push({
                                id: `evt-punch-${i}`,
                                type: "Punch",
                                punchType: punch.attendanceType === "IN" ? "Punch In" : "Punch Out",
                                time: punch.deviceTime || punch.createdAt,
                                lat: punch.latitude,
                                lng: punch.longitude,
                                address: punch.address || "Unknown Address",
                                deviceId: punch.deviceId
                            });
                        });
                    }

                    events.sort((a, b) => new Date(a.time) - new Date(b.time));

                    const calcDist = (lat1, lon1, lat2, lon2) => {
                        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
                        const R = 6371;
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLon = (lon2 - lon1) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    };

                    const getDriveStats = (startTime, endTime) => {
                        let distKm = 0;
                        let driveEndPt = null;
                        for (let pt of report.route) {
                            const ptTime = new Date(pt.time);
                            if (ptTime >= new Date(startTime) && ptTime <= new Date(endTime)) {
                                if (driveEndPt) distKm += calcDist(driveEndPt.lat, driveEndPt.lng, pt.lat, pt.lng);
                                driveEndPt = pt;
                            }
                        }
                        return { distKm: distKm.toFixed(2), durationMin: Math.round((new Date(endTime) - new Date(startTime)) / 60000) };
                    };

                    let finalEvents = [];
                    for (let i = 0; i < events.length; i++) {
                        finalEvents.push(events[i]);
                        if (i < events.length - 1) {
                            const driveStartTime = events[i].endTime || events[i].time;
                            const driveEndTime = events[i + 1].time;
                            const { distKm, durationMin } = getDriveStats(driveStartTime, driveEndTime);
                            if (durationMin > 0) {
                                finalEvents.push({ id: `evt-drive-${i}`, type: "Drive", time: driveStartTime, endTime: driveEndTime, distanceKm: distKm, durationMin });
                            }
                        }
                    }
                    setTimelineEvents(finalEvents);
                } else {
                    setTimelineEvents([]);
                }
            } catch (err) {
                if (!isCurrent) return;
                console.error(err);
                setTimelineReport(null);
                setTimelineEvents([]);
            } finally {
                if (isCurrent) setTimelineLoading(false);
            }
        };
        fetchTimelineReport();
        return () => { isCurrent = false; };
    }, [timelineUser, timelineDate]);

    // ─── Reverse geocode stops ──────────────────────────────────────────────
    useEffect(() => {
        if (!isLoaded || !window.google?.maps?.Geocoder || !timelineEvents.length) return;
        const stopsToGeocode = timelineEvents.filter(e => e.type === "Stop" && (!e.address || e.address === "Unknown Location" || e.address === "Unknown"));
        if (!stopsToGeocode.length) return;
        if (window._isGeocodingStops) return;
        window._isGeocodingStops = true;

        const geocoder = new window.google.maps.Geocoder();
        
        const processStopsSequentially = async () => {
            for (const e of stopsToGeocode) {
                // Sleep for 700ms between Google API requests to prevent OVER_QUERY_LIMIT
                await new Promise(res => setTimeout(res, 700));
                
                await new Promise(resolve => {
                    geocoder.geocode({ location: { lat: Number(e.lat), lng: Number(e.lng) } }, async (results, status) => {
                        let finalAddress = null;

                        if (status === "OK" && results[0]) {
                            finalAddress = results[0].formatted_address;
                        } else {
                            console.warn(`Google Geocoding failed for ${e.lat},${e.lng}. Status: ${status}. Trying Fallback Nominiatim...`);
                            try {
                                const osmRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.lat}&lon=${e.lng}`);
                                if (osmRes.data && osmRes.data.display_name) {
                                     finalAddress = osmRes.data.display_name;
                                }
                            } catch (osmErr) {
                                console.error("OSM Fallback also failed.");
                            }
                        }

                        if (!finalAddress) {
                            finalAddress = "Address not found"; // stop retries
                        }

                        // Update State visually
                        setTimelineEvents(prev => prev.map(ev => ev.id === e.id ? { ...ev, address: finalAddress } : ev));

                        // Save to backend (only if we got a real address, don't save the 'not found' text over and over)
                        if (finalAddress !== "Address not found") {
                            try {
                                const token = getToken();
                                await axios.put("/api/v1/location/address", {
                                    employeeId: timelineUser,
                                    lat: e.lat,
                                    lng: e.lng,
                                    address: finalAddress
                                }, { headers: { Authorization: `Bearer ${token}` } });
                            } catch (err) {
                                console.error("Error saving geocoded address:", err);
                            }
                        }
                        
                        resolve();
                    });
                });
            }
            window._isGeocodingStops = false;
        };

        processStopsSequentially();
    }, [timelineEvents, isLoaded, timelineUser]);

    // ─── Fit map bounds ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!timelineMapInstance || !window.google) return;
        const bounds = new window.google.maps.LatLngBounds();
        let hasPoints = false;
        
        fullRoutePath.forEach(pt => { if (pt?.lat != null && pt?.lng != null) { bounds.extend(new window.google.maps.LatLng(pt.lat, pt.lng)); hasPoints = true; } });
        
        if (liveLocation?.latitude && liveLocation?.longitude) {
            bounds.extend(new window.google.maps.LatLng(liveLocation.latitude, liveLocation.longitude));
            hasPoints = true;
        }

        if (hasPoints) {
            timelineMapInstance.fitBounds(bounds);
            const listener = window.google.maps.event.addListener(timelineMapInstance, 'idle', () => {
                if (timelineMapInstance.getZoom() > 16) timelineMapInstance.setZoom(16);
                window.google.maps.event.removeListener(listener);
            });
        }
    }, [fullRoutePath, timelineMapInstance, liveLocation]);

    // ─── Playback ──────────────────────────────────────────────────────────
    useEffect(() => { setPlaybackState({ isPlaying: false, speed: 1, currentIndex: 0 }); }, [timelineReport]);

    useEffect(() => {
        let timer;
        if (playbackState.isPlaying && smoothedTimelinePath.length > 0) {
            timer = setInterval(() => {
                setPlaybackState(prev => {
                    const maxIdx = smoothedTimelinePath.length - 1;
                    if (prev.currentIndex >= maxIdx) return { ...prev, isPlaying: false };
                    const nextIdx = Math.min(prev.currentIndex + prev.speed, maxIdx);
                    return { ...prev, currentIndex: nextIdx };
                });
            }, 300);
        }
        return () => clearInterval(timer);
    }, [playbackState.isPlaying, playbackState.speed, smoothedTimelinePath.length]);

    useEffect(() => {
        if (playbackState.isPlaying && timelineMapInstance && smoothedTimelinePath.length > 0) {
            const pt = smoothedTimelinePath[playbackState.currentIndex];
            if (pt) timelineMapInstance.panTo({ lat: pt.lat, lng: pt.lng });
        }
    }, [playbackState.currentIndex, playbackState.isPlaying, timelineMapInstance, smoothedTimelinePath]);

    const onTimelineLoad = useCallback((map) => setTimelineMapInstance(map), []);
    const onTimelineUnmount = useCallback(() => setTimelineMapInstance(null), []);
    const changeTimelineDate = (days) => {
        const curr = new Date(timelineDate);
        curr.setDate(curr.getDate() + days);
        setTimelineDate(curr.toISOString().split("T")[0]);
    };

    const selUserName = usersList.find(u => u._id === timelineUser)?.name || "Select User";

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', gap: '16px' }}>
            {/* Top Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {/* Staff Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <div
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            style={{ border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', padding: '10px 16px', cursor: 'pointer', minWidth: '300px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                        >
                            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#111827' }}>
                                {timelineUser
                                    ? (usersList.find(u => u._id === timelineUser)?.name.toUpperCase() + (usersList.find(u => u._id === timelineUser)?.employeeId ? ` (${usersList.find(u => u._id === timelineUser)?.employeeId})` : ""))
                                    : "-- Select Staff --"}
                            </span>
                            <i className={`ri-arrow-${isDropdownOpen ? 'up' : 'down'}-s-line`} style={{ color: '#9ca3af', fontSize: '1.2rem' }}></i>
                        </div>
                        {isDropdownOpen && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '340px', display: 'flex', flexDirection: 'column' }}>
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
                                    {usersList
                                        .filter(u => `${u.name} ${u.employeeId || ""}`.toLowerCase().includes(timelineSearch.toLowerCase()))
                                        .sort((a, b) => {
                                            const statA = dashboardStats.find(s => s._id === a._id);
                                            const statB = dashboardStats.find(s => s._id === b._id);
                                            const aOnTrip = statA && (statA.totalDistance > 0 || statA.motionTime > 0 || statA.punchCount > 0) ? 1 : 0;
                                            const bOnTrip = statB && (statB.totalDistance > 0 || statB.motionTime > 0 || statB.punchCount > 0) ? 1 : 0;
                                            if (aOnTrip !== bOnTrip) return bOnTrip - aOnTrip;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(usr => {
                                        const userStat = dashboardStats.find(s => s._id === usr._id);
                                        const isOnTrip = userStat && (userStat.totalDistance > 0 || userStat.motionTime > 0 || userStat.punchCount > 0);
                                        return (
                                            <div
                                                key={usr._id}
                                                onClick={() => { setTimelineUser(usr._id); setIsDropdownOpen(false); setTimelineSearch(""); }}
                                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: timelineUser === usr._id ? '#f8fafc' : '#fff' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                                onMouseOut={(e) => e.currentTarget.style.background = timelineUser === usr._id ? '#f8fafc' : '#fff'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: timelineUser === usr._id ? '#3b82f6' : 'transparent' }}></div>
                                                    <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{usr.name.toUpperCase()} <span style={{ color: '#6b7280', fontWeight: 400 }}>{usr.employeeId ? `(${usr.employeeId})` : ""}</span></span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isOnTrip ? '#10b981' : '#eab308' }}>
                                                    {isOnTrip ? 'On Trip' : 'Not Traveled'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Date Picker */}
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

            {/* Split Layout */}
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
                            <span>{new Date(timelineDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} <span style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px', fontSize: '0.7rem', color: '#374151' }}>Asia/Kolkata</span></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 600, color: '#6b7280' }}>{timelineReport ? timelineReport.totalDistance : "0.00"} km</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>{timelineReport ? `${Math.floor(timelineReport.motionTime / 60)}h ${timelineReport.motionTime % 60}m` : "0h 0m"}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px 0' }}>
                        {/* Live Now Card (Visible only for today) */}
                        {liveLocation && (
                            <div
                                onClick={() => {
                                    if (timelineMapInstance && liveLocation.latitude) {
                                        timelineMapInstance.panTo({ lat: liveLocation.latitude, lng: liveLocation.longitude });
                                        timelineMapInstance.setZoom(17);
                                    }
                                }}
                                style={{
                                    margin: '0 8px 16px 8px',
                                    padding: '12px',
                                    background: '#eff6ff',
                                    border: '1px solid #3b82f6',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div className="pulse-dot" style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }}></div>
                                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#1e40af' }}>LIVE NOW — {liveLocation.name}</span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600 }}>
                                        {liveLocation.lastSeen ? new Date(liveLocation.lastSeen).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "Now"}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                    <i className="ri-map-pin-2-fill" style={{ color: '#3b82f6', fontSize: '1.2rem', marginTop: '2px' }}></i>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e3a8a', fontWeight: 600, lineHeight: '1.4' }}>
                                            {liveLocation.address || "Fetching address..."}
                                        </p>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#3b82f6', fontWeight: 500 }}>
                                            TAP TO FOCUS ON MAP
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {timelineLoading && <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading timeline...</p>}
                        {!timelineLoading && timelineEvents.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '0.85rem' }}>No tracking data found for this date.</p>}

                        {!timelineLoading && timelineEvents.map((evt, idx) => {
                            const isActive = activeTimelineEvent?.id === evt.id;
                            return (
                                <div
                                    key={evt.id}
                                    onClick={() => {
                                        const newEvt = isActive ? null : evt;
                                        setActiveTimelineEvent(newEvt);
                                        if (!isActive && timelineMapInstance) {
                                            if (evt.lat && evt.lng) {
                                                timelineMapInstance.panTo({ lat: Number(evt.lat), lng: Number(evt.lng) });
                                                timelineMapInstance.setZoom(16);
                                            } else if (evt.type === 'Drive') {
                                                const startPt = fullRoutePath.find(p => new Date(p.time) >= new Date(evt.time));
                                                if (startPt) { timelineMapInstance.panTo({ lat: startPt.lat, lng: startPt.lng }); timelineMapInstance.setZoom(15); }
                                            }
                                        }
                                        // Jump playback scrubber to drive start
                                        if (!isActive && evt.type === 'Drive' && smoothedTimelinePath.length > 0) {
                                            const startT = new Date(evt.time);
                                            let closestIdx = 0, minDiff = Infinity;
                                            smoothedTimelinePath.forEach((pt, i) => {
                                                const diff = Math.abs(new Date(pt.time) - startT);
                                                if (diff < minDiff) { minDiff = diff; closestIdx = i; }
                                            });
                                            setPlaybackState(p => ({ ...p, isPlaying: false, currentIndex: closestIdx }));
                                        }
                                    }}
                                    style={{ display: 'flex', marginBottom: '6px', position: 'relative', cursor: 'pointer', background: isActive || evt.type === 'Punch' ? '#f0fdf4' : 'transparent', border: isActive || evt.type === 'Punch' ? '1px solid #10b981' : '1px solid transparent', borderRadius: '8px', padding: '12px 8px', marginLeft: '4px', marginRight: '4px' }}
                                >
                                    {idx !== timelineEvents.length - 1 && (
                                        <div style={{ position: 'absolute', left: '68px', top: '38px', bottom: '-15px', width: '1px', background: '#d1d5db', zIndex: 1 }}></div>
                                    )}
                                    <div style={{ width: '56px', textAlign: 'right', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, paddingTop: '1px' }}>
                                        {new Date(evt.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div style={{ width: '26px', display: 'flex', justifyContent: 'center', zIndex: 2 }}>
                                        {evt.type === 'Start' ? <i className="ri-focus-3-line" style={{ color: isActive ? '#10b981' : '#6b7280', fontSize: '1.2rem', marginTop: '-2px' }}></i>
                                            : evt.type === 'Stop' ? <i className="ri-hourglass-2-line" style={{ color: isActive ? '#10b981' : '#6b7280', fontSize: '1.1rem', marginTop: '-1px' }}></i>
                                                : evt.type === 'Outage' ? <i className="ri-cloud-off-line" style={{ color: '#ef4444', fontSize: '1.2rem', marginTop: '-2px' }}></i>
                                                    : evt.type === 'Punch' ? <i className="ri-price-tag-3-line" style={{ color: '#10b981', fontSize: '1.2rem', marginTop: '-2px' }}></i>
                                                    : <i className="ri-steering-2-line" style={{ color: isActive ? '#10b981' : '#6b7280', fontSize: '1.2rem', marginTop: '-2px' }}></i>}
                                    </div>
                                    <div style={{ flex: 1, paddingLeft: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: evt.type === 'Outage' ? '#ef4444' : (isActive || evt.type === 'Punch' ? '#111827' : '#111827') }}>
                                                {evt.type === 'Start' ? 'Tracking Started' : evt.type === 'Punch' ? 'Geotag' : evt.type}
                                            </span>
                                            {evt.type === 'Drive' && (
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#111827', fontWeight: 600 }}>{evt.distanceKm} km</span>
                                                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>{evt.durationMin >= 60 ? `${Math.floor(evt.durationMin / 60)}h ${evt.durationMin % 60}m` : `${evt.durationMin}m`}</span>
                                                </div>
                                            )}
                                            {evt.type === 'Stop' && <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{evt.duration >= 60 ? `${Math.floor(evt.duration / 60)}h ${evt.duration % 60}m` : `${evt.duration}m`}</span>}
                                            {evt.type === 'Outage' && <span style={{ fontSize: '0.75rem', color: '#111827', fontWeight: 600 }}>{evt.durationMin >= 60 ? `${Math.floor(evt.durationMin / 60)}h ${evt.durationMin % 60}m` : `${evt.durationMin}m`}</span>}
                                            {evt.type === 'Punch' && <span style={{ fontSize: '0.65rem', border: '1px solid #10b981', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{evt.punchType}</span>}
                                        </div>
                                        {evt.deviceId && evt.type === 'Punch' && <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '2px', fontFamily: 'monospace' }}>{evt.deviceId}</div>}
                                        {evt.address && (evt.type === 'Stop' || evt.type === 'Punch') && <div style={{ fontSize: '0.72rem', color: (isActive || evt.type === 'Punch') ? '#16a34a' : '#6b7280', marginTop: '6px', lineHeight: '1.4' }}>{evt.address}</div>}
                                        {evt.type === 'Outage' && evt.message && (
                                            <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '6px', lineHeight: '1.4', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                {evt.message} <i className="ri-error-warning-line" style={{ marginLeft: '4px' }}></i>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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
                            options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: false }}
                        >
                            {(!timelineLoading && timelineReport) ? (
                                <React.Fragment key={`route-wrapper-${timelineUser}-${timelineDate}`}>
                                    {fullRoutePath.length > 0 && (() => {
                                        const curPt = smoothedTimelinePath[playbackState.currentIndex];
                                        const playbackArrow = smoothedTimelinePath.length > 0 && window.google && (
                                            <Marker
                                                position={{ lat: curPt?.lat || 0, lng: curPt?.lng || 0 }}
                                                icon={{
                                                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                                    scale: 7, fillColor: '#10b981', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 1,
                                                    rotation: playbackState.currentIndex > 0
                                                        ? window.google?.maps?.geometry?.spherical?.computeHeading(
                                                            new window.google.maps.LatLng(smoothedTimelinePath[playbackState.currentIndex - 1].lat, smoothedTimelinePath[playbackState.currentIndex - 1].lng),
                                                            new window.google.maps.LatLng(curPt.lat, curPt.lng)
                                                        ) || 0 : 0
                                                }}
                                                zIndex={100}
                                            />
                                        );

                                        return (
                                            <>
                                                {/* 1. Unconditionally render the BASE full route (black line) */}
                                                {routeSegments.filter(s => s.length >= 2).map((seg, idx) => (
                                                    <Polyline key={`base-seg-${idx}`} path={seg}
                                                        options={{ strokeColor: '#111827', strokeOpacity: 0.9, strokeWeight: 3, zIndex: 1 }} />
                                                ))}
                                                {window.google && <Marker
                                                    position={{ lat: fullRoutePath[0].lat, lng: fullRoutePath[0].lng }}
                                                    icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#111827', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }}
                                                    label={{ text: 'S', color: 'white', fontSize: '8px', fontWeight: 'bold' }} zIndex={3} />}
                                                {window.google && <Marker
                                                    position={{ lat: fullRoutePath[fullRoutePath.length - 1].lat, lng: fullRoutePath[fullRoutePath.length - 1].lng }}
                                                    icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#111827', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }}
                                                    zIndex={3} />}

                                                {/* Render ALL Punch Markers directly */}
                                                {timelineEvents.filter(e => e.type === 'Punch').map(e => (
                                                    window.google && <Marker
                                                        key={`punch-marker-${e.id}`}
                                                        position={{ lat: Number(e.lat), lng: Number(e.lng) }}
                                                        icon={{
                                                            path: "M17.5 5.5l-6-6a1 1 0 0 0-1.414 0l-9.5 9.5a1 1 0 0 0 0 1.414l6 6a1 1 0 0 0 1.414 0l9.5-9.5a1 1 0 0 0 .5-.707V6a1 1 0 0 0-1-1zm-2 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
                                                            scale: 1,
                                                            anchor: new window.google.maps.Point(10, 10),
                                                            fillColor: "#10b981",
                                                            fillOpacity: 1,
                                                            strokeColor: "#ffffff",
                                                            strokeWeight: 1,
                                                        }}
                                                        zIndex={8}
                                                        onClick={() => setActiveTimelineEvent(activeTimelineEvent?.id === e.id ? null : e)}
                                                    />
                                                ))}

                                                {/* 2. Conditionally overlay DRIVE segment if selected */}
                                                {activeTimelineEvent?.type === 'Drive' && (() => {
                                                    const highlightedSegments = routeSegments
                                                        .map(seg => seg.filter(p => {
                                                            if (!p.time || !activeTimelineEvent.time || !activeTimelineEvent.endTime) return false;
                                                            const t = new Date(p.time);
                                                            return t >= new Date(activeTimelineEvent.time) && t <= new Date(activeTimelineEvent.endTime);
                                                        }))
                                                        .filter(s => s.length >= 2);
                                                    if (!highlightedSegments.length) return null;
                                                    const firstPt = highlightedSegments[0][0];
                                                    const lastSeg = highlightedSegments[highlightedSegments.length - 1];
                                                    const lastPt = lastSeg[lastSeg.length - 1];
                                                    return (
                                                        <>
                                                            {highlightedSegments.map((hSeg, idx) => (
                                                                <Polyline key={`drive-only-${activeTimelineEvent.id}-${idx}`} path={hSeg}
                                                                    options={{ strokeColor: '#16a34a', strokeOpacity: 1, strokeWeight: 5, zIndex: 5 }} />
                                                            ))}
                                                            {window.google && <Marker key={`drive-s-${activeTimelineEvent.id}`}
                                                                position={{ lat: firstPt.lat, lng: firstPt.lng }}
                                                                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#16a34a', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }}
                                                                label={{ text: 'S', color: 'white', fontSize: '8px', fontWeight: 'bold' }} zIndex={10} />}
                                                            {window.google && <Marker key={`drive-e-${activeTimelineEvent.id}`}
                                                                position={{ lat: lastPt.lat, lng: lastPt.lng }}
                                                                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#16a34a', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }}
                                                                zIndex={9} />}
                                                        </>
                                                    );
                                                })()}

                                                {/* 3. Conditionally overlay STOP circle if selected */}
                                                {activeTimelineEvent?.type === 'Stop' && activeTimelineEvent.lat && (
                                                    <>
                                                        {window.google && <Marker key={`stop-marker-${activeTimelineEvent.id}`}
                                                            position={{ lat: Number(activeTimelineEvent.lat), lng: Number(activeTimelineEvent.lng) }}
                                                            icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#000000', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }}
                                                            zIndex={10} />}
                                                        <Circle key={`stop-circle-${activeTimelineEvent.id}`}
                                                            center={{ lat: Number(activeTimelineEvent.lat), lng: Number(activeTimelineEvent.lng) }}
                                                            radius={300}
                                                            options={{ fillColor: '#10b981', fillOpacity: 0.25, strokeColor: '#10b981', strokeWeight: 1, zIndex: 2 }} />
                                                    </>
                                                )}

                                                {/* 4. Live Marker (Pulsing Dot) */}
                                                {liveLocation?.latitude && window.google && (
                                                    <Marker
                                                        position={{ lat: Number(liveLocation.latitude), lng: Number(liveLocation.longitude) }}
                                                        icon={{
                                                            path: window.google.maps.SymbolPath.CIRCLE,
                                                            scale: 8,
                                                            fillColor: '#3b82f6',
                                                            fillOpacity: 1,
                                                            strokeColor: '#ffffff',
                                                            strokeWeight: 2,
                                                        }}
                                                        zIndex={150}
                                                        title={`Live: ${liveLocation.name}`}
                                                    />
                                                )}

                                                {/* 5. Unconditionally render playback arrow on top */}
                                                {playbackArrow}
                                            </>
                                        );
                                    })()}
                                </React.Fragment>
                            ) : null}
                        </GoogleMap>
                    ) : (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f3f4f6", color: "#6b7280" }}>Loading Timeline Map...</div>
                    )}

                    {/* Map controls */}
                    <div style={{ position: 'absolute', right: '16px', top: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}><i className="ri-stack-line" style={{ fontSize: '1.2rem' }}></i></button>
                        <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}><i className="ri-fullscreen-line" style={{ fontSize: '1.2rem' }}></i></button>
                    </div>
                    <div style={{ position: 'absolute', right: '16px', bottom: '80px', display: 'flex', flexDirection: 'column', gap: '0', background: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}><i className="ri-add-line" style={{ fontSize: '1.4rem' }}></i></button>
                        <button style={{ width: '40px', height: '40px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4b5563' }}><i className="ri-subtract-line" style={{ fontSize: '1.4rem' }}></i></button>
                    </div>

                    {/* Playback Bar */}
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
                            {smoothedTimelinePath.length > 0 ? new Date(smoothedTimelinePath[playbackState.currentIndex].time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
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

export default TimelineTab;
