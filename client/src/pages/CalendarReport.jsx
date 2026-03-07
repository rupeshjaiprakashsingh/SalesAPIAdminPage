import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/Dashboard.css"; // Reuse dashboard styles

export default function CalendarReport() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [fromDate, setFromDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [toDate, setToDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    );
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    const token = JSON.parse(localStorage.getItem("auth")) || "";

    // Fetch Users
    useEffect(() => {
        const fetchUsersTimelineStyle = async () => {
           try {
                const res = await axios.get("/api/v1/users?limit=1000", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if(res.data && res.data.users) {
                     setUsers(res.data.users);
                } else if(Array.isArray(res.data)){
                     setUsers(res.data);
                } else if(res.data && res.data.data) {
                     setUsers(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch users", error);
            }
        };
        fetchUsersTimelineStyle();
    }, [token]);

    // Fetch Calendar Report
    const fetchReport = async () => {
        if (!selectedUser) {
            toast.error("Please select a user");
            return;
        }
        if (!fromDate || !toDate) {
            toast.error("Please select from and to dates");
            return;
        }

        setLoading(true);
        setReportData(null);
        try {
            const res = await axios.get(
                `/api/v1/reports/calendar-report?userId=${selectedUser}&fromDate=${fromDate}&toDate=${toDate}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            // Array of reports
            setReportData(res.data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    // Download All Users PDF in one click
    const downloadAllUsersPDF = async () => {
        if (!fromDate || !toDate) {
            toast.error("Please select from and to dates");
            return;
        }

        setSelectedUser("all"); // sync UI Dropdown
        setLoading(true);
        setReportData(null);
        try {
            const res = await axios.get(
                `/api/v1/reports/calendar-report?userId=all&fromDate=${fromDate}&toDate=${toDate}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setReportData(res.data.data);
            
            // Wait for React to render the new data to DOM before printing
            setTimeout(() => {
                window.print();
            }, 800);
            
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    // Simple print function for currently viewed report
    const printCurrentReport = () => {
        window.print();
    };

    return (
        <div className="report-container" style={{ padding: '20px' }}>
            {/* INJECT PDF PRINT STYLES */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #calendar-printable, #calendar-printable * {
                        visibility: visible;
                    }
                    #calendar-printable {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

            <div className="no-print">
                <h2>Calendar Report 📅</h2>
                <p>View date-wise attendance status, working hours, and monthly summary.</p>

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
                            <option value="all">** ALL USERS **</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={e => setFromDate(e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
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
                            fontWeight: 'bold',
                            height: '38px'
                        }}
                    >
                        {loading ? "Loading..." : "Get Report"}
                    </button>

                    <button
                        onClick={downloadAllUsersPDF}
                        disabled={loading}
                        style={{
                            padding: '8px 20px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            height: '38px',
                            marginLeft: 'auto'
                        }}
                        title="Fetch all users data and open Print to PDF dialog"
                    >
                        {loading ? "Preparing PDF..." : "Download PDF For All Users"}
                    </button>
                    
                    {reportData && (
                        <button
                            onClick={printCurrentReport}
                            disabled={loading}
                            style={{
                                padding: '8px 20px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                height: '38px'
                            }}
                        >
                            Print Displayed
                        </button>
                    )}
                </div>
            </div>

            {/* PRINTABLE AREA */}
            <div id="calendar-printable">
                {/* Ensure a clean title is printed */}
                <h2 style={{ display: 'none' }} className="print-only-title">
                     Attendance Calendar Report ({fromDate} to {toDate})
                </h2>
                <style>{`
                    @media print {
                        .print-only-title { display: block !important; text-align: center; margin-bottom: 20px; }
                        .page-break { page-break-after: always; }
                    }
                `}</style>
                
                {reportData && reportData.map((report, userIndex) => (
                    <div key={userIndex} className="page-break" style={{ marginBottom: '50px' }}>
                        
                        <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginTop: '10px' }}>
                            Employee: <span style={{color: '#3b82f6'}}>{report.user.name}</span> ({report.user.email})
                        </h3>
                        
                        {/* Stats Cards */}
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <div style={cardStyle}>
                                <h4>Total Days</h4>
                                <p style={{...statValueStyle, color: '#4b5563'}}>{report.totalDays}</p>
                            </div>
                            <div style={cardStyle}>
                                <h4>Present Days</h4>
                                <p style={{ ...statValueStyle, color: '#10b981' }}>{report.presentDays}</p>
                            </div>
                            <div style={cardStyle}>
                                <h4>Absent Days</h4>
                                <p style={{ ...statValueStyle, color: '#ef4444' }}>{report.absentDays}</p>
                            </div>
                            <div style={cardStyle}>
                                <h4>Total Hrs</h4>
                                <p style={{ ...statValueStyle, color: '#3b82f6' }}>{report.totalWorkingHours} hrs</p>
                            </div>
                        </div>

                        {/* Calendar Grid representation */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                            gap: '15px',
                            marginTop: '20px'
                        }}>
                            {report.calendarData.map((day, idx) => {
                                const isPresent = day.status === "Present";
                                return (
                                    <div key={idx} style={{
                                        border: `2px solid ${isPresent ? '#d1fae5' : '#fee2e2'}`,
                                        borderRadius: '8px',
                                        padding: '10px',
                                        textAlign: 'center',
                                        backgroundColor: isPresent ? '#ecfdf5' : '#fef2f2',
                                        pageBreakInside: 'avoid'
                                    }}>
                                        <h4 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{new Date(day.date).toLocaleDateString()}</h4>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#6b7280' }}>
                                            {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                                        </p>
                                        <span style={{ 
                                            display: 'inline-block', 
                                            padding: '4px 8px', 
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            backgroundColor: isPresent ? '#10b981' : '#ef4444',
                                            color: 'white',
                                            marginBottom: isPresent ? '10px' : '0'
                                        }}>
                                            {day.status}
                                        </span>
                                        {isPresent && (
                                            <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '5px' }}>
                                                <p style={{ margin: '2px 0' }}><strong>In:</strong> {day.checkIn ? new Date(day.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</p>
                                                <p style={{ margin: '2px 0' }}><strong>Out:</strong> {day.checkOut ? new Date(day.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</p>
                                                <p style={{ margin: '4px 0 0 0', color: '#3b82f6', fontWeight: 'bold', borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
                                                    <strong>Hrs:</strong> {parseFloat(day.workingHours).toFixed(2)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            
            {!reportData && !loading && (
                <div style={{textAlign: 'center', marginTop: '50px', color: '#6b7280'}}>
                    Select an employee or "All Users" and fetch the report.
                </div>
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
    margin: '10px 0 0 0'
};
