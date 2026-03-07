import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { GoogleMap, Marker, InfoWindow, Polyline, useJsApiLoader } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '10px'
};

const defaultPosition = {
    lat: 28.6139,
    lng: 77.2090
};

const LiveTracking = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [userRoute, setUserRoute] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyBAbFbmXPOSgsBnhuYrCtSQ7yXK_0nB--Y"
    });

    const getToken = () => {
        const authItem = localStorage.getItem("auth");
        if (!authItem) return null;
        try {
            return authItem.startsWith('{') ? JSON.parse(authItem).token : JSON.parse(authItem);
        } catch {
            return null;
        }
    };

    const fetchAttendanceMapData = useCallback(async () => {
        setLoading(true);
        try {
            const token = getToken();
            if (!token) return;

            // Fetch a large limit from attendance list to map them
            const response = await axios.get("/api/v1/attendance/list?limit=5000", {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                // Filter locally by date range
                const records = response.data.records || [];
                const filtered = records.filter(r => {
                    const d = r.dateStr;
                    let matches = true;
                    if (startDate && d < startDate) matches = false;
                    if (endDate && d > endDate) matches = false;
                    return matches;
                });

                // Map to marker objects
                const mappedEmployees = filtered.map(r => {
                    const inRec = r.inRecord;
                    const outRec = r.outRecord;
                    const userDetails = r.userDetails || {};
                    const lastLoc = userDetails.lastLocation;

                    if (!inRec && !outRec && !lastLoc) return null;

                    // Priority map: Live tracking location -> check out location -> check in location
                    const displayLat = lastLoc?.lat || outRec?.latitude || inRec?.latitude;
                    const displayLng = lastLoc?.lng || outRec?.longitude || inRec?.longitude;

                    if (!displayLat || !displayLng) return null;

                    return {
                        id: `${r.userId}_${r.dateStr}`, // Unique key for range mappings
                        actualUserId: r.userId,
                        name: userDetails.name || 'Unknown',
                        date: r.dateStr,
                        latitude: displayLat,
                        longitude: displayLng,
                        status: outRec ? "Checked Out" : (inRec ? "Checked In" : "Absent"),
                        batteryPercentage: userDetails.batteryStatus || outRec?.batteryPercentage || inRec?.batteryPercentage,
                        isOnline: userDetails.isOnline || false, // Real online status
                        lastUpdated: lastLoc?.timestamp || outRec?.deviceTime || inRec?.deviceTime,
                        inRecord: inRec,
                        outRecord: outRec,
                        liveLocation: lastLoc
                    };
                }).filter(Boolean);

                setEmployees(mappedEmployees);
            }
        } catch (error) {
            console.error("Error fetching attendance map data:", error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchAttendanceMapData();
        // Optional polling if they are viewing "today"
        let interval;
        if (startDate === todayStr && endDate === todayStr) {
            interval = setInterval(fetchAttendanceMapData, 15000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [fetchAttendanceMapData, startDate, endDate, todayStr]);

    // Timeline Path Logic
    useEffect(() => {
        const fetchTimeline = async () => {
            if (!selectedEmp) {
                setUserRoute(null);
                return;
            }

            try {
                const token = getToken();
                if (!token) return;

                const res = await axios.get(`/api/v1/reports/timeline-report?userId=${selectedEmp.actualUserId}&date=${selectedEmp.date}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success && res.data.data.route.length > 0) {
                    setUserRoute(res.data.data.route);
                } else {
                    setUserRoute([]);
                }
            } catch (err) {
                console.error("Error fetching timeline:", err);
                setUserRoute([]);
            }
        };

        fetchTimeline();
    }, [selectedEmp]);

    const handleEmployeeClick = (emp) => {
        if (selectedEmp && selectedEmp.id === emp.id) {
            setSelectedEmp(null);
        } else {
            setSelectedEmp(emp);
        }
    };

    const mapCenter = selectedEmp
        ? { lat: Number(selectedEmp.latitude), lng: Number(selectedEmp.longitude) }
        : (employees.length > 0 ? { lat: Number(employees[0].latitude), lng: Number(employees[0].longitude) } : defaultPosition);

    const onlineIcon = 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
    const offlineIcon = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
    const liveIcon = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';

    const pathOptions = {
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 4,
    };

    return (
        <div className="p-4" style={{ height: 'calc(100vh - 100px)', padding: "1rem", display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
                <h2 className="text-2xl font-bold" style={{ margin: 0 }}>Map View</h2>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '5px' }}>From:</label>
                        <input
                            type="date"
                            style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '5px' }}>To:</label>
                        <input
                            type="date"
                            style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchAttendanceMapData}
                        style={{ padding: '6px 15px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Apply
                    </button>
                    {loading && <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>}
                </div>
            </div>

            <div className="map-container" style={{ flexGrow: 1, width: "100%", borderRadius: "10px", overflow: "hidden", border: "1px solid #ddd", minHeight: '400px' }}>
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={mapCenter}
                        zoom={selectedEmp ? 14 : 12}
                    >
                        {!selectedEmp && employees.map((emp) => (
                            <Marker
                                key={emp.id}
                                position={{ lat: Number(emp.latitude), lng: Number(emp.longitude) }}
                                icon={emp.isOnline ? onlineIcon : offlineIcon}
                                onClick={() => handleEmployeeClick(emp)}
                            />
                        ))}

                        {/* Rendering Timeline Path if specific employee selected */}
                        {selectedEmp && (
                            <>
                                {/* Timeline Polyline */}
                                {userRoute && userRoute.length > 0 && (
                                    <Polyline path={userRoute.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))} options={pathOptions} />
                                )}

                                {/* Start Marker (Check IN) */}
                                {selectedEmp.inRecord && selectedEmp.inRecord.latitude && (
                                    <Marker
                                        position={{ lat: Number(selectedEmp.inRecord.latitude), lng: Number(selectedEmp.inRecord.longitude) }}
                                        label="IN"
                                        title="Check-In Position"
                                        icon={onlineIcon}
                                    />
                                )}

                                {/* End Marker (Check OUT) */}
                                {selectedEmp.outRecord && selectedEmp.outRecord.latitude && (
                                    <Marker
                                        position={{ lat: Number(selectedEmp.outRecord.latitude), lng: Number(selectedEmp.outRecord.longitude) }}
                                        label="OUT"
                                        title="Check-Out Position"
                                        icon={offlineIcon}
                                    />
                                )}

                                {/* Current Live Marker */}
                                {selectedEmp.liveLocation && selectedEmp.liveLocation.lat && (
                                    <Marker
                                        position={{ lat: Number(selectedEmp.liveLocation.lat), lng: Number(selectedEmp.liveLocation.lng) }}
                                        label="LIVE"
                                        title="Current Live Position"
                                        icon={liveIcon}
                                        onClick={() => setSelectedEmp(null)} // Unselect by clicking marker again
                                    >
                                        <InfoWindow
                                            position={{ lat: Number(selectedEmp.liveLocation.lat), lng: Number(selectedEmp.liveLocation.lng) }}
                                            onCloseClick={() => setSelectedEmp(null)}
                                        >
                                            <div style={{ minWidth: '200px' }}>
                                                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedEmp.name} ({selectedEmp.date})</h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.9rem' }}>
                                                    <div><strong>Status:</strong> <span style={{ color: selectedEmp.status === 'Checked In' ? 'green' : 'red', fontWeight: 'bold' }}>{selectedEmp.status}</span></div>
                                                    <div><strong>Battery:</strong> {selectedEmp.batteryPercentage || 'N/A'}%</div>
                                                    <div><strong>Online:</strong> {selectedEmp.isOnline ? 'Yes' : 'No'}</div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedEmp(null)}
                                                    style={{ marginTop: '10px', background: '#e2e8f0', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                                                    Close Timeline
                                                </button>
                                            </div>
                                        </InfoWindow>
                                    </Marker>
                                )}

                                {/* Fallback InfoWindow if no liveLocation exists but they have IN/OUT */}
                                {(!selectedEmp.liveLocation || !selectedEmp.liveLocation.lat) && (
                                    <InfoWindow
                                        position={{ lat: Number(selectedEmp.latitude), lng: Number(selectedEmp.longitude) }}
                                        onCloseClick={() => setSelectedEmp(null)}
                                    >
                                        <div style={{ minWidth: '200px' }}>
                                            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedEmp.name} ({selectedEmp.date})</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.9rem' }}>
                                                <div><strong>Status:</strong> <span style={{ color: selectedEmp.status === 'Checked In' ? 'green' : 'red', fontWeight: 'bold' }}>{selectedEmp.status}</span></div>
                                                <div><strong>Battery:</strong> {selectedEmp.batteryPercentage || 'N/A'}%</div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedEmp(null)}
                                                style={{ marginTop: '10px', background: '#e2e8f0', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                                                Close Timeline
                                            </button>
                                        </div>
                                    </InfoWindow>
                                )}
                            </>
                        )}
                    </GoogleMap>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading Maps...</div>
                )}
            </div>

            <div style={{ marginTop: '1rem', overflowY: 'auto', maxHeight: '200px' }}>
                <h3 style={{ marginBottom: '10px' }}>Recorded Data ({employees.length}) (Click to see Path A to B)</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {employees.map(emp => (
                        <div
                            key={emp.id}
                            onClick={() => handleEmployeeClick(emp)}
                            style={{
                                padding: '0.8rem',
                                border: selectedEmp?.id === emp.id ? '2px solid #3b82f6' : '1px solid #eee',
                                borderRadius: '5px',
                                background: emp.isOnline ? '#f0fdf4' : '#fef2f2',
                                width: '200px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: selectedEmp?.id === emp.id ? '0 4px 6px rgba(59, 130, 246, 0.2)' : 'none'
                            }}>
                            <strong>{emp.name}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                                {emp.status} | {emp.date}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveTracking;
