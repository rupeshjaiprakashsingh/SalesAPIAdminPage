
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { GoogleMap, Polyline, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import "../styles/Dashboard.css"; // Reuse dashboard styles

const containerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '8px',
    marginTop: '20px'
};

const defaultCenter = {
    lat: 28.6139,
    lng: 77.2090
};

export default function TimelineReport() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyBAbFbmXPOSgsBnhuYrCtSQ7yXK_0nB--Y"
    });

    const token = JSON.parse(localStorage.getItem("auth")) || "";

    // Fetch Users
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get("/api/v1/users?limit=1000", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUsers(res.data.users || []);
            } catch (error) {
                toast.error("Failed to fetch users");
            }
        };
        fetchUsers();
    }, [token]);

    // Fetch Timeline Report
    const fetchReport = async () => {
        if (!selectedUser) {
            toast.error("Please select a user");
            return;
        }
        setLoading(true);
        setReportData(null);
        try {
            const res = await axios.get(`/api/v1/reports/timeline-report?userId=${selectedUser}&date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReportData(res.data.data);
            if (res.data.data.route.length === 0) {
                toast.info("No route data found for this date.");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    const pathOptions = {
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        fillColor: '#3b82f6',
        fillOpacity: 0.35,
        clickable: false,
        draggable: false,
        editable: false,
        visible: true,
        radius: 30000,
        zIndex: 1
    };

    if (!isLoaded) return <div>Loading...</div>;

    return (
        <div className="report-container" style={{ padding: '20px' }}>
            <h2>Timeline Engine 📍</h2>
            <p>View employee route history and stats.</p>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'end' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Select Employee</label>
                    <select
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                        style={{ padding: '8px', minWidth: '200px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value="">-- Select User --</option>
                        {users.map(u => (
                            <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>

                <button
                    onClick={fetchReport}
                    disabled={loading}
                    style={{
                        padding: '8px 20px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? "Loading..." : "View Timeline"}
                </button>
            </div>

            {reportData && (
                <>
                    {/* Stats Cards */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <div style={cardStyle}>
                            <h4>Total Distance</h4>
                            <p style={statValueStyle}>{reportData.totalDistance} km</p>
                        </div>
                        <div style={cardStyle}>
                            <h4>Idle Time</h4>
                            <p style={statValueStyle}>{reportData.idleTime} min</p>
                        </div>
                        <div style={cardStyle}>
                            <h4>Motion Time</h4>
                            <p style={statValueStyle}>{reportData.motionTime} min</p>
                        </div>
                    </div>

                    {/* Map */}
                    <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={reportData.route.length > 0 ? { lat: reportData.route[0].lat, lng: reportData.route[0].lng } : defaultCenter}
                            zoom={13}
                        >
                            {reportData.route.length > 0 && (
                                <Polyline
                                    path={reportData.route}
                                    options={pathOptions}
                                />
                            )}

                            {/* All Route Points */}
                            {reportData.route.map((point, index) => {
                                // Don't draw tiny dot if it's start or end, as we have big markers for them
                                if (index === 0 || index === reportData.route.length - 1) return null;
                                return (
                                    <Marker
                                        key={`point-${index}`}
                                        position={{ lat: point.lat, lng: point.lng }}
                                        icon={{
                                            path: "M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0",
                                            fillColor: "#3b82f6",
                                            fillOpacity: 1,
                                            strokeWeight: 1,
                                            strokeColor: "white",
                                            scale: 0.3
                                        }}
                                        onClick={() => setSelectedPoint({ ...point, label: `Ping at ${new Date(point.time).toLocaleTimeString()}` })}
                                    />
                                );
                            })}

                            {/* Start Marker */}
                            {reportData.route.length > 0 && (
                                <Marker
                                    position={reportData.route[0]}
                                    label={{ text: "S", color: "white", fontWeight: "bold" }}
                                    title="Start"
                                    onClick={() => setSelectedPoint({ ...reportData.route[0], label: "Start Point" })}
                                />
                            )}

                            {/* End Marker */}
                            {reportData.route.length > 1 && (
                                <Marker
                                    position={reportData.route[reportData.route.length - 1]}
                                    label={{ text: "E", color: "white", fontWeight: "bold" }}
                                    title="End"
                                    onClick={() => setSelectedPoint({ ...reportData.route[reportData.route.length - 1], label: "End Point" })}
                                />
                            )}

                            {/* Stops */}
                            {reportData.stopDetails.map((stop, idx) => (
                                <Marker
                                    key={idx}
                                    position={{ lat: stop.latitude, lng: stop.longitude }}
                                    icon={{
                                        path: "M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0",
                                        fillColor: "red",
                                        fillOpacity: 0.6,
                                        strokeWeight: 0,
                                        scale: 0.5
                                    }}
                                    title={`Stop: ${stop.duration} min`}
                                    onClick={() => setSelectedPoint({
                                        lat: stop.latitude,
                                        lng: stop.longitude,
                                        time: stop.startTime,
                                        label: `Stop: ${stop.duration} min`,
                                        address: stop.address
                                    })}
                                />
                            ))}

                            {selectedPoint && (
                                <InfoWindow
                                    position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                                    onCloseClick={() => setSelectedPoint(null)}
                                >
                                    <div style={{ padding: '5px' }}>
                                        <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#1f2937' }}>{selectedPoint.label}</h4>
                                        <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}><strong>Time:</strong> {new Date(selectedPoint.time).toLocaleTimeString()}</p>
                                        
                                        {selectedPoint.battery !== undefined && (
                                            <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: selectedPoint.battery < 20 ? 'red' : 'green' }}>
                                                <strong>🔋 Battery:</strong> {selectedPoint.battery}%
                                            </p>
                                        )}
                                        {selectedPoint.accuracy !== undefined && (
                                            <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
                                                <strong>🎯 Accuracy:</strong> {selectedPoint.accuracy.toFixed(1)}m
                                            </p>
                                        )}
                                        
                                        {selectedPoint.address && (
                                            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666', borderTop: '1px solid #eee', paddingTop: '5px' }}>
                                                📍 {selectedPoint.address}
                                            </p>
                                        )}
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    </div>
                </>
            )}
        </div>
    );
}

const cardStyle = {
    flex: '1',
    minWidth: '150px',
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    border: '1px solid #e5e7eb',
    textAlign: 'center'
};

const statValueStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#3b82f6',
    margin: '10px 0 0 0'
};
