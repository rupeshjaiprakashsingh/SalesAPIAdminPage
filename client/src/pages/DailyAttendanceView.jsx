import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export default function DailyAttendanceView() {
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [search, setSearch] = useState("");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(10);
    const [page, setPage] = useState(1);

    const token = JSON.parse(localStorage.getItem("auth")) || localStorage.getItem("token") || "";

    useEffect(() => {
        fetchData();
    }, [date]);

    // Go to first page on search
    useEffect(() => {
        setPage(1);
    }, [search]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/reports/date-range-report?fromDate=${date}&toDate=${date}&userId=all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setData(res.data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load daily attendance view");
        }
        setLoading(false);
    };

    const changeDate = (days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        setDate(d.toISOString().split("T")[0]);
    };

    const downloadExcel = async () => {
        try {
            const response = await axios.get(`/api/v1/reports/export-date-range-excel?fromDate=${date}&toDate=${date}&userId=all`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `daily_attendance_${date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
            toast.error("Failed to download Excel");
        }
    };

    const filteredData = data.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

    const totalPages = Math.ceil(filteredData.length / limit) || 1;
    const currentData = filteredData.slice((page - 1) * limit, page * limit);

    return (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginTop: '24px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {/* Header / Title */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea', flexShrink: 0 }}>
                    <i className="ri-user-3-fill" style={{ fontSize: '13px' }}></i>
                </div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Daily Attendance View</h3>
            </div>

            {/* Controls Bar */}
            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f3f4f6' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <i className="ri-search-line" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '14px' }}></i>
                        <input
                            type="text"
                            placeholder="Search by Name"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '260px', padding: '8px 12px 8px 36px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', color: '#374151', fontSize: '0.85rem', fontWeight: 500 }}
                        />
                    </div>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                        <i className="ri-filter-3-fill"></i> Filter
                    </button>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', width: '1px', height: '1px' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                        <button onClick={() => changeDate(-1)} style={{ padding: '8px 12px', background: 'white', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer', color: '#4b5563' }}>
                            <i className="ri-arrow-left-s-line"></i>
                        </button>
                        <div style={{ padding: '8px 16px', background: 'white', fontWeight: 600, fontSize: '0.85rem', color: '#374151', minWidth: '130px', textAlign: 'center' }}>
                            {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <button onClick={() => changeDate(1)} style={{ padding: '8px 12px', background: 'white', border: 'none', borderLeft: '1px solid #e5e7eb', cursor: 'pointer', color: '#4b5563' }}>
                            <i className="ri-arrow-right-s-line"></i>
                        </button>
                        <button style={{ padding: '8px 12px', background: 'white', border: 'none', borderLeft: '1px solid #e5e7eb', cursor: 'pointer', color: '#4b5563' }}>
                            <i className="ri-calendar-line"></i>
                        </button>
                    </div>

                    <button onClick={downloadExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'white', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                        <i className="ri-download-2-line"></i> Download
                    </button>
                    <button style={{ padding: '8px 8px', background: 'transparent', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                        <i className="ri-settings-3-line"></i>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ background: 'white', color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
                            <th style={{ padding: '16px 24px', fontWeight: 600 }}>Name</th>
                            <th style={{ padding: '16px 24px', fontWeight: 600 }}>Department</th>
                            <th style={{ padding: '16px 24px', fontWeight: 600 }}>Shift</th>
                            <th style={{ padding: '16px 24px', fontWeight: 600 }}>Attendance</th>
                            <th style={{ padding: '16px 24px', fontWeight: 600 }}>In Time</th>
                            <th style={{ padding: '16px 24px', fontWeight: 600 }}>Out Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                                    <i className="ri-loader-4-line ri-spin" style={{ fontSize: '1.5rem', display: 'inline-block', marginBottom: '8px' }}></i><br/>
                                    Loading daily attendance...
                                </td>
                            </tr>
                        ) : currentData.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>No records found for the selected date</td>
                            </tr>
                        ) : (
                            currentData.map((user, idx) => {
                                const record = user.dailyRecords && user.dailyRecords[date];
                                const hasIn = record && record.checkIn;
                                const hasOut = record && record.checkOut;
                                
                                let statusText = "Absent";
                                if (hasIn && hasOut) statusText = "Present";
                                else if (hasIn && !hasOut) statusText = "Pending";

                                const inTime = hasIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "-";
                                const outTime = hasOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "-";

                                return (
                                    <tr key={`${user.email}-${idx}`} style={{ borderBottom: '1px solid #f9fafb', fontSize: '0.85rem', color: '#374151' }}>
                                        <td style={{ padding: '16px 24px', textTransform: 'uppercase', color: '#111827' }}>{user.name}</td>
                                        <td style={{ padding: '16px 24px', color: '#9ca3af' }}>-</td>
                                        <td style={{ padding: '16px 24px', color: '#6b7280' }}>Regular</td>
                                        <td style={{ padding: '16px 24px', color: '#4b5563' }}>{statusText}</td>
                                        <td style={{ padding: '16px 24px', color: '#4b5563' }}>{inTime}</td>
                                        <td style={{ padding: '16px 24px', color: '#4b5563' }}>{outTime}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination / Footer */}
            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280', fontSize: '0.85rem' }}>
                    <span>Rows Per Page</span>
                    <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: 'white', color: '#374151', cursor: 'pointer' }}>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '6px 10px', border: 'none', background: 'transparent', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#d1d5db' : '#6b7280' }}><i className="ri-arrow-left-double-line"></i></button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', border: 'none', background: 'transparent', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#d1d5db' : '#6b7280' }}><i className="ri-arrow-left-s-line"></i></button>
                    
                    {[...Array(totalPages)].map((_, i) => {
                        // Max 5 pages shown at a time
                        if (totalPages > 5 && (i + 1 < page - 2 || i + 1 > page + 2)) {
                            if (i + 1 === page - 3 || i + 1 === page + 3) return <span key={i} style={{ padding: '6px', color: '#9ca3af' }}>...</span>;
                            return null;
                        }
                        return (
                            <button key={i} onClick={() => setPage(i + 1)} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: page === i + 1 ? '#2563eb' : 'transparent', color: page === i + 1 ? 'white' : '#4b5563', cursor: 'pointer', fontWeight: page === i + 1 ? 600 : 500 }}>
                                {i + 1}
                            </button>
                        )
                    })}
                    
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 10px', border: 'none', background: 'transparent', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#d1d5db' : '#6b7280' }}><i className="ri-arrow-right-s-line"></i></button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '6px 10px', border: 'none', background: 'transparent', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#d1d5db' : '#6b7280' }}><i className="ri-arrow-right-double-line"></i></button>
                </div>
            </div>
        </div>
    );
}
