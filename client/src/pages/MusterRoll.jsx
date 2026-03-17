import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import "../styles/global.css"; // Reuse standard table styles

export default function MusterRoll() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Controls
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    
    // Expand State: mapping of userId -> boolean
    const [expandedRows, setExpandedRows] = useState({});
    
    const token = JSON.parse(localStorage.getItem("auth")) || "";

    useEffect(() => {
        fetchMusterRoll();
    }, [selectedMonth, selectedYear]);

    const fetchMusterRoll = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `/api/v1/reports/monthly-report?year=${selectedYear}&month=${selectedMonth}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data && res.data.data) {
                setReportData(res.data.data);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch muster roll");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const res = await axios.get(
                `/api/v1/reports/monthly-excel?year=${selectedYear}&month=${selectedMonth}`,
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob' 
                }
            );
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `MusterRoll_${selectedYear}_${selectedMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error("Failed to download Excel");
        }
    };

    const toggleRow = (userId) => {
        setExpandedRows(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    const handleExpandAll = () => {
        const allExpanded = reportData.every(user => expandedRows[user.email]);
        const newState = {};
        if (!allExpanded) {
            // expand all
            reportData.forEach(user => {
                newState[user.email] = true;
            });
        }
        setExpandedRows(newState);
    };

    const filteredData = reportData.filter(u => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getDaysInMonth = (year, month) => {
        return new Date(year, month, 0).getDate();
    };

    const daysInCurrentMonth = getDaysInMonth(selectedYear, selectedMonth);

    // Calculate unmarked days, half days etc.
    const processUserStats = (user) => {
        let halfDays = 0;
        let presentDates = Object.keys(user.dailyRecords || {});
        
        presentDates.forEach(dateStr => {
            const record = user.dailyRecords[dateStr];
            // Arbitrary logic: if working hours < 5, consider half day
            if (record.workingHours && record.workingHours < 5 && record.workingHours > 0) {
                halfDays++;
            }
        });

        // The API actually says daysAbsent = daysInMonth - daysPresent. 
        // We'll recalculate unmarked logically if we want to separate it. 
        // For standard view, let's keep it simple: we define unmarked as past days lacking data, and future days as unmarked.
        const pastDaysInMonth = Math.min(new Date().getDate(), daysInCurrentMonth); 
        // Just rough logic:
        const present = user.daysPresent || 0;
        const absent = user.daysAbsent || 0;
        const totalP = `${present}P`;
        
        return {
            present: present - halfDays,
            halfDay: halfDays > 0 ? halfDays : "-",
            absent: absent > 0 ? absent : "-",
            paidLeave: "-",
            unmarked: absent, // Reusing API's absent definition as unmarked representation to visually match
            overtime: "-",
            fine: "-",
            total: totalP
        };
    };

    return (
        <div style={{ padding: '0 1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header Area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: '#111827', fontWeight: 600, fontSize: '1rem', flexShrink: 0 }}>
                <div style={{ background: '#f3e8ff', color: '#9333ea', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ri-group-line"></i>
                </div>
                <span>Attendance Muster Roll</span>
            </div>

            {/* Controls Bar */}
            <div style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                flexWrap: 'wrap', gap: '10px', marginBottom: '15px', flexShrink: 0
            }}>
                <div style={{ position: 'relative', width: '280px' }}>
                    <i className="ri-search-line" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
                    <input 
                        type="text" 
                        placeholder="Search by name or staff ID" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 12px 8px 35px', borderRadius: '8px', border: '1px solid #e5e7eb',
                            fontSize: '0.8rem', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                        onClick={handleExpandAll}
                        style={{ padding: '6px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}
                    >
                        Expand All
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, marginRight: '4px', cursor: 'pointer' }}
                        >
                            {Array.from({ length: 12 }).map((_, i) => (
                                <option key={i+1} value={i+1}>
                                    {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <i className="ri-calendar-line" style={{ marginLeft: '8px', color: '#6b7280' }}></i>
                    </div>

                    <button 
                        onClick={handleDownload}
                        style={{ padding: '6px 12px', background: 'white', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <i className="ri-download-2-line"></i>
                        Download
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div style={{ 
                background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' 
            }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8rem', color: '#111827', flexShrink: 0 }}>
                    Regular
                </div>
                
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                            <tr>
                                <th style={thStyle}>Staff Name</th>
                                <th style={thStyle}>Present</th>
                                <th style={thStyle}>Absent</th>
                                <th style={thStyle}>Half Day</th>
                                <th style={thStyle}>Paid Leave</th>
                                <th style={thStyle}>Unmarked</th>
                                <th style={thStyle}>Overtime</th>
                                <th style={thStyle}>Fine</th>
                                <th style={thStyle}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '0.8rem' }}>Loading...</td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '0.8rem' }}>No records found for this month</td>
                                </tr>
                            ) : (
                                filteredData.map((user, idx) => {
                                    const isExpanded = expandedRows[user.email];
                                    const stats = processUserStats(user);
                                    
                                    return (
                                        <React.Fragment key={user.email || idx}>
                                            <tr style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => toggleRow(user.email)}>
                                                <td style={{ ...tdStyle, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`} style={{ color: '#9ca3af', fontSize: '1rem', minWidth: '16px' }}></i>
                                                    <span style={{ whiteSpace: 'nowrap' }}>{user.name?.toUpperCase()}</span>
                                                </td>
                                                <td style={tdStyle}>{stats.present}</td>
                                                <td style={tdStyle}>{stats.absent}</td>
                                                <td style={tdStyle}>{stats.halfDay}</td>
                                                <td style={tdStyle}>{stats.paidLeave}</td>
                                                <td style={tdStyle}>{stats.unmarked}</td>
                                                <td style={tdStyle}>{stats.overtime}</td>
                                                <td style={tdStyle}>{stats.fine}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ 
                                                        background: '#1f2937', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 
                                                    }}>
                                                        {stats.total}
                                                    </span>
                                                </td>
                                            </tr>
                                            
                                            {/* EXPANDED INNER ROW */}
                                            {isExpanded && (
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                    <td colSpan="9" style={{ padding: '10px 20px', fontSize: '0.72rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                                                                const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i+1).padStart(2, '0')}`;
                                                                const dayRec = user.dailyRecords && user.dailyRecords[dayStr];
                                                                let bg = '#e5e7eb';
                                                                let text = '-';
                                                                let color = '#6b7280';
                                                                
                                                                if (dayRec && dayRec.checkIn) {
                                                                    bg = '#dcfce7';
                                                                    color = '#15803d';
                                                                    text = 'P'; // Present
                                                                    if (dayRec.workingHours && dayRec.workingHours < 5) {
                                                                        bg = '#fef9c3'; color = '#a16207'; text = 'HD';
                                                                    }
                                                                } else if (new Date(dayStr) < new Date()) {
                                                                    bg = '#fee2e2'; color = '#b91c1c'; text = 'A'; // Absent past
                                                                }

                                                                return (
                                                                    <div key={i} style={{ 
                                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', width: '26px' 
                                                                    }}>
                                                                        <span style={{ fontSize: '0.6rem', color: '#9ca3af', marginBottom: '2px' }}>{i+1}</span>
                                                                        
                                                                        {user._id && text !== '-' && text !== 'A' ? (
                                                                            <Link to={`/dashboard/attendance/${user._id}?date=${dayStr}`} style={{ textDecoration: 'none' }} title="View details">
                                                                                <div style={{ 
                                                                                    width: '20px', height: '20px', borderRadius: '4px', background: bg, color: color,
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                                                                                    cursor: 'pointer'
                                                                                }}>
                                                                                    {text}
                                                                                </div>
                                                                            </Link>
                                                                        ) : (
                                                                            <div style={{ 
                                                                                width: '20px', height: '20px', borderRadius: '4px', background: bg, color: color,
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                                                            }}>
                                                                                {text}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>
    );
}

const thStyle = {
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'none',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap'
};

const tdStyle = {
    padding: '8px 12px',
    fontSize: '0.75rem',
    color: '#4b5563',
    whiteSpace: 'nowrap'
};
