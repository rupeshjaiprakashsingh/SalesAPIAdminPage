import React, { useState, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import "../styles/GeoDashboard.css";
import LiveTrackingTab from "./geo/LiveTrackingTab";
import TimelineTab from "./geo/TimelineTab";
import DashboardTab from "./geo/DashboardTab";

const TABS = ["Live Tracking", "Timeline", "Dashboard", "Reports", "Settings", "How To Use"];

const GeoDashboard = () => {
    const [activeTab, setActiveTab] = useState("Timeline");

    // Memoize libraries to prevent script re-loads
    const libraries = useMemo(() => ["geometry", "drawing", "places"], []);

    // Load Google Maps script ONCE at the top level with all required libraries
    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        libraries,
    });

    // Called from DashboardTab when user clicks a staff name → jump to Timeline
    const handleNavigateToTimeline = (userId, date) => {
        setActiveTab("Timeline");
        // TimelineTab manages its own state; we use a small bridge via sessionStorage
        // so the tab can pick up the requested userId+date on mount/change.
        sessionStorage.setItem("geo_timeline_userId", userId);
        sessionStorage.setItem("geo_timeline_date", date);
    };

    return (
        <div className="geo-dashboard-layout" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            {/* Tab Bar */}
            <div className="geo-tabs" style={{ display: 'flex', gap: '8px', background: '#fdfdfd', borderBottom: '1px solid #e5e7eb', padding: '8px 16px 0 16px', borderRadius: '12px 12px 0 0' }}>
                {TABS.map(tab => (
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

            {/* Tab Content - Only render Map-intensive tabs when isLoaded is true to prevent crashes */}
            <div className="geo-tab-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {isLoaded ? (
                    <>
                        {activeTab === "Live Tracking" && <LiveTrackingTab isLoaded={isLoaded} />}
                        {activeTab === "Timeline" && <TimelineTab isLoaded={isLoaded} />}
                    </>
                ) : (
                    (activeTab === "Live Tracking" || activeTab === "Timeline") && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280', background: '#ffffff', borderRadius: '12px' }}>
                            Loading Maps API...
                        </div>
                    )
                )}
                {activeTab === "Dashboard" && <DashboardTab onNavigateToTimeline={handleNavigateToTimeline} />}

                {!["Live Tracking", "Timeline", "Dashboard"].includes(activeTab) && (
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
