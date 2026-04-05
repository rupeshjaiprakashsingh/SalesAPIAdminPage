import React, { useState, useEffect } from "react";
import axios from "axios";
import { getToken, formatTimeStr, getBatteryColor, getBatteryIcon } from "./geoUtils";

const DashboardTab = ({ onNavigateToTimeline }) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const [dashboardDate, setDashboardDate] = useState(todayStr);
    const [searchQuery, setSearchQuery] = useState("");
    const [dashboardStats, setDashboardStats] = useState({ summary: {}, data: [] });
    const [dashboardLoading, setDashboardLoading] = useState(false);

    const changeDashboardDate = (days) => {
        const curr = new Date(dashboardDate);
        curr.setDate(curr.getDate() + days);
        setDashboardDate(curr.toISOString().split("T")[0]);
    };

    useEffect(() => {
        const fetchDashboardStats = async () => {
            const token = getToken();
            if (!token) return;
            setDashboardLoading(true);
            try {
                const res = await axios.get(`/api/v1/reports/dashboard-stats?date=${dashboardDate}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) setDashboardStats(res.data);
            } catch (err) {
                console.error("Error fetching dashboard stats:", err);
            } finally {
                setDashboardLoading(false);
            }
        };
        fetchDashboardStats();
    }, [dashboardDate]);

    const todayData = dashboardStats.data || [];
    const summary = dashboardStats.summary || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
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

            {/* Metric Cards */}
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
                        <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#6b7280' }}>Spent in Motion</span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{formatTimeStr(summary.totalMotionTime)}</div>
                    <i className="ri-pin-distance-line" style={{ position: 'absolute', right: '16px', top: '16px', fontSize: '1.2rem', color: '#d946ef' }}></i>
                </div>
                <div style={{ background: '#f8fbff', border: '1px solid #eff6ff', borderRadius: '8px', padding: '16px', position: 'relative' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
                        <span>Total Time</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#6b7280' }}>Spent in Rest</span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827' }}>{formatTimeStr(summary.totalIdleTime)}</div>
                    <i className="ri-history-line" style={{ position: 'absolute', right: '16px', top: '16px', fontSize: '1.2rem', color: '#3b82f6' }}></i>
                </div>
            </div>

            {/* Tracking Table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#fdfdfd', borderBottom: '1px solid #f3f4f6' }}>
                                {['Name', 'Status', 'Total Distance', 'Total Time', 'Total Time In Motion', 'Total Time At Rest'].map(h => (
                                    <th key={h} style={{ padding: '8px 16px', fontSize: '0.65rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dashboardLoading ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Fetching dashboard data...</td></tr>
                            ) : todayData.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No tracking data found for this date</td></tr>
                            ) : todayData
                                .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .sort((a, b) => {
                                    const valA = a.tripStatus === 'On Trip' ? 2 : (a.tripStatus === 'Traveled' ? 1 : 0);
                                    const valB = b.tripStatus === 'On Trip' ? 2 : (b.tripStatus === 'Traveled' ? 1 : 0);
                                    if (valA !== valB) return valB - valA;
                                    return a.name.localeCompare(b.name);
                                })
                                .map((u, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f9fafb' }}>
                                    <td style={{ padding: '8px 16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div
                                                style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer', maxWidth: '280px' }}
                                                onClick={() => onNavigateToTimeline && onNavigateToTimeline(u._id, dashboardDate)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase' }} title="View Timeline">{u.name}</span>
                                                    {u.employeeId && <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{u.employeeId}</span>}
                                                </div>
                                                {u.address && u.address !== "Location not available" && (
                                                    <span style={{ fontSize: '0.65rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.address}>
                                                        <i className="ri-map-pin-line" style={{ marginRight: '2px' }}></i>{u.address}
                                                    </span>
                                                )}
                                            </div>
                                            {u.battery != null && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: getBatteryColor(u.battery), minWidth: '45px', justifyContent: 'flex-end', cursor: 'default' }} title={`Latest Battery: ${u.battery}%`}>
                                                    <span style={{ fontSize: '0.9rem' }}>{getBatteryIcon(u.battery)}</span> {u.battery}%
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 16px' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: u.tripStatus === 'On Trip' ? '#10b981' : (u.tripStatus === 'Traveled' ? '#6b7280' : '#eab308') }}>
                                            {u.tripStatus || (u.totalDistance > 0 ? 'Traveled' : 'Not Traveled')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 16px', fontSize: '0.75rem', color: '#4b5563' }}>{Number(u.totalDistance || 0).toFixed(1)} kms</td>
                                    <td style={{ padding: '8px 16px', fontSize: '0.75rem', color: '#4b5563' }}>{formatTimeStr(u.totalTime)}</td>
                                    <td style={{ padding: '8px 16px', fontSize: '0.75rem', color: '#4b5563' }}>{formatTimeStr(u.motionTime)}</td>
                                    <td style={{ padding: '8px 16px', fontSize: '0.75rem', color: '#4b5563' }}>{formatTimeStr(u.idleTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardTab;
