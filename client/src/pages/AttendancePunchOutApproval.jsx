import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

const AttendancePunchOutApproval = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialDate = searchParams.get('date') || new Date().toLocaleDateString('en-CA');

    const [date, setDate] = useState(initialDate);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [zoomPhoto, setZoomPhoto] = useState(null);
    const selectAllRef = useRef(null);

    const token =
        JSON.parse(localStorage.getItem("auth")) ||
        localStorage.getItem("token") ||
        "";

    /* ── Fetch only users who have a Punch OUT record ───────────────── */
    const fetchAttendance = async () => {
        try {
            setLoading(true);
            setSelectedIds([]);
            const res = await axios.get(
                `/api/v1/attendance/list?startDate=${date}&endDate=${date}&limit=500`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const records = res.data.records || [];
            // Only rows with an OUT record
            setAttendance(records.filter(r => r.outRecord));
        } catch (err) {
            console.error('[PunchOutApproval] fetch error:', err);
            toast.error('Failed to fetch attendance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAttendance(); }, [date]);

    /* ── Selection — ONLY Pending records can be selected ─────────── */
    const getPendingIds = (list) => list
        .filter(u => u.outRecord?._id && u.outRecord?.approvalStatus === 'Pending')
        .map(u => String(u.outRecord._id));

    const filtered = attendance.filter(a =>
        a.userDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const pendingIds  = getPendingIds(filtered);
    const isAllSel    = pendingIds.length > 0 && pendingIds.every(id => selectedIds.includes(id));
    const isSomeSel   = selectedIds.length > 0 && !isAllSel;

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = isSomeSel;
    }, [isSomeSel]);

    const handleSelectAll = (e) => {
        // Only select/deselect Pending records
        if (e.target.checked) setSelectedIds(prev => [...new Set([...prev, ...pendingIds])]);
        else setSelectedIds(prev => prev.filter(id => !pendingIds.includes(id)));
    };

    const toggleRow = (uDay, checked) => {
        // Guard: never allow selecting a non-Pending record
        if (uDay.outRecord?.approvalStatus !== 'Pending') return;
        const id = String(uDay.outRecord._id);
        if (checked) setSelectedIds(prev => [...new Set([...prev, id])]);
        else setSelectedIds(prev => prev.filter(i => i !== id));
    };

    /* ── Approve / Reject ──────────────────────────────────────────── */
    const handleAction = async (approvalStatus) => {
        if (selectedIds.length === 0) { toast.warn('Select at least one record'); return; }
        setSubmitting(true);
        try {
            await axios.post('/api/v1/attendance/confirm-approval',
                { ids: selectedIds, approvalStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const label = approvalStatus === 'Approved' ? 'approved' : 'rejected';
            toast.success(`Punch-Out records ${label} successfully`);
            setSelectedIds([]);
            fetchAttendance();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    /* ── Date nav ──────────────────────────────────────────────────── */
    const todayStr = new Date().toLocaleDateString('en-CA');
    const shiftDate = (delta) => {
        const d = new Date(date);
        d.setDate(d.getDate() + delta);
        const shifted = d.toLocaleDateString('en-CA');
        if (delta > 0 && shifted > todayStr) return;
        setDate(shifted);
    };

    /* ── Helpers ───────────────────────────────────────────────────── */
    const fmtTime = (dt) => dt
        ? new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
        : null;

    const workHours = (uDay) => {
        const wh = uDay.outRecord?.workingHours;
        if (wh) {
            const h = Math.floor(wh), m = Math.round((wh - h) * 60);
            return `${h}h ${m}m`;
        }
        return null;
    };

    const statusBadge = (status) => {
        const map = {
            Approved: { bg: '#dcfce7', color: '#166534' },
            Rejected: { bg: '#fee2e2', color: '#991b1b' },
            Pending:  { bg: '#fef9c3', color: '#854d0e' },
        };
        const s = map[status] || map['Pending'];
        return (
            <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap'
            }}>
                {status || 'Pending'}
            </span>
        );
    };

    const pendingCount = attendance.filter(a => a.outRecord?.approvalStatus === 'Pending').length;

    /* ── Render ────────────────────────────────────────────────────── */
    return (
        <div style={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* ── Page Title Row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: '#f3f4f6', border: 'none', cursor: 'pointer',
                        borderRadius: 8, padding: '7px 10px',
                        display: 'flex', alignItems: 'center', color: '#374151', fontSize: 18
                    }}
                >
                    <i className="ri-arrow-left-s-line" />
                </button>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                            Punch-Out Approval
                        </h2>
                        <span style={{
                            background: '#fce7f3', color: '#be185d', fontSize: 11, fontWeight: 700,
                            padding: '3px 10px', borderRadius: 999
                        }}>
                            <i className="ri-logout-box-line" /> OUT
                        </span>
                    </div>
                    {pendingCount > 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
                            {pendingCount} punch-out record{pendingCount !== 1 ? 's' : ''} awaiting review
                        </p>
                    )}
                </div>
            </div>

            {/* ── Filter Row ── */}
            <div style={{
                background: 'white', borderRadius: 12, padding: '12px 18px',
                marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
            }}>
                {/* Date navigation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => shiftDate(-1)} style={navBtn}>
                        <i className="ri-arrow-left-s-line" />
                    </button>
                    <input
                        type="date" value={date}
                        max={todayStr}
                        onChange={e => setDate(e.target.value)}
                        style={{
                            padding: '8px 12px', borderRadius: 8,
                            border: '1px solid #e5e7eb', outline: 'none',
                            fontSize: 14, fontWeight: 600, color: '#374151',
                            background: '#f9fafb', cursor: 'pointer'
                        }}
                    />
                    <button
                        onClick={() => shiftDate(1)}
                        disabled={date >= todayStr}
                        style={{ ...navBtn, opacity: date >= todayStr ? 0.4 : 1, cursor: date >= todayStr ? 'not-allowed' : 'pointer' }}
                    >
                        <i className="ri-arrow-right-s-line" />
                    </button>
                    {date !== todayStr && (
                        <button
                            onClick={() => setDate(todayStr)}
                            style={{
                                ...navBtn,
                                background: '#fdf2f8', color: '#be185d',
                                border: '1px solid #fbcfe8', fontSize: 12, fontWeight: 700,
                                padding: '7px 12px'
                            }}
                        >
                            Today
                        </button>
                    )}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <i className="ri-search-line" style={{
                        position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 15
                    }} />
                    <input
                        type="text" placeholder="Search staff..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%', padding: '9px 12px 9px 36px',
                            borderRadius: 8, border: '1px solid #e5e7eb',
                            outline: 'none', fontSize: 14, background: '#f9fafb',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Summary pills */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Pill bg="#fce7f3" color="#be185d">
                        <i className="ri-group-line" /> {attendance.length} Staff
                    </Pill>
                    {pendingCount > 0 && (
                        <Pill bg="#fef9c3" color="#854d0e">
                            <i className="ri-time-line" /> {pendingCount} Pending
                        </Pill>
                    )}
                    {selectedIds.length > 0 && (
                        <Pill bg="#fdf2f8" color="#be185d">
                            <i className="ri-checkbox-multiple-line" /> {selectedIds.length} selected
                        </Pill>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{
                background: 'white', borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                overflow: 'hidden', flex: 1
            }}>
                {/* Table header label */}
                <div style={{
                    padding: '12px 20px', borderBottom: '1px solid #f3f4f6',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'linear-gradient(90deg,#fdf2f8 0%,#fff 100%)'
                }}>
                    <i className="ri-logout-box-line" style={{ color: '#be185d', fontSize: 16 }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#be185d' }}>Punch-Out Records</span>
                    <span style={{
                        background: '#fce7f3', padding: '2px 10px',
                        borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#be185d'
                    }}>
                        {filtered.length}
                    </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #f3f4f6' }}>
                                <th style={{ padding: '12px 16px', width: 44, textAlign: 'center' }}>
                                    <input
                                        ref={selectAllRef}
                                        type="checkbox"
                                        checked={isAllSel}
                                        onChange={handleSelectAll}
                                        disabled={pendingIds.length === 0}
                                        title={pendingIds.length === 0 ? 'No pending records to select' : 'Select all pending'}
                                        style={{ width: 16, height: 16, cursor: pendingIds.length > 0 ? 'pointer' : 'not-allowed', accentColor: '#be185d' }}
                                    />
                                </th>
                                <th style={th}>Staff Name</th>
                                <th style={th}>Punch Out Details</th>
                                <th style={th}>Working Hours</th>
                                <th style={th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                            <div style={spinnerStyle} />
                                            <span style={{ fontSize: 14 }}>Loading punch-out records…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 60 }}>
                                        <i className="ri-logout-box-line" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                                        <span style={{ color: '#9ca3af', fontSize: 15 }}>
                                            No punch-out records for this date
                                        </span>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((uDay, idx) => {
                                    const rec = uDay.outRecord;
                                    const isPending = rec?.approvalStatus === 'Pending';
                                    const sel = rec?._id && isPending && selectedIds.includes(String(rec._id));
                                    const time = fmtTime(rec?.deviceTime);
                                    const wh = workHours(uDay);

                                    return (
                                        <tr
                                            key={uDay.userDetails?._id || idx}
                                            style={{
                                                borderBottom: '1px solid #f3f4f6',
                                                background: sel ? '#fdf2f8' : rec?.approvalStatus === 'Approved' ? '#f0fdf4' : rec?.approvalStatus === 'Rejected' ? '#fff5f5' : 'white',
                                                transition: 'background 0.15s',
                                                opacity: isPending ? 1 : 0.75
                                            }}
                                        >
                                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                {isPending ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={!!sel}
                                                        onChange={e => toggleRow(uDay, e.target.checked)}
                                                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#be185d' }}
                                                    />
                                                ) : (
                                                    <i
                                                        className={rec?.approvalStatus === 'Approved' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}
                                                        style={{ fontSize: 18, color: rec?.approvalStatus === 'Approved' ? '#16a34a' : '#dc2626' }}
                                                        title={`Already ${rec?.approvalStatus}`}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                                                    {uDay.userDetails?.name || '—'}
                                                </div>
                                                {isPending && (
                                                    <span style={{
                                                        display: 'inline-block', marginTop: 4,
                                                        fontSize: 10, fontWeight: 700,
                                                        padding: '2px 7px', borderRadius: 999,
                                                        background: '#fef9c3', color: '#854d0e'
                                                    }}>
                                                        Pending Review
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                                {rec ? (
                                                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                        {rec.photoUrl ? (
                                                            <img
                                                                src={rec.photoUrl}
                                                                alt="selfie"
                                                                onClick={() => setZoomPhoto(rec.photoUrl)}
                                                                style={{
                                                                    width: 44, height: 44, borderRadius: 6,
                                                                    objectFit: 'cover', flexShrink: 0,
                                                                    border: '1.5px solid #fbcfe8', cursor: 'zoom-in'
                                                                }}
                                                                onError={e => e.target.style.display = 'none'}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                width: 44, height: 44, borderRadius: 6,
                                                                background: '#f3f4f6', flexShrink: 0,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                <i className="ri-camera-off-line" style={{ color: '#d1d5db', fontSize: 16 }} />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                {time && <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{time}</span>}
                                                                {statusBadge(rec.approvalStatus)}
                                                            </div>
                                                            {rec.address && (
                                                                <div style={{
                                                                    fontSize: 11, color: '#6b7280', marginTop: 3,
                                                                    maxWidth: 260, whiteSpace: 'nowrap',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis'
                                                                }} title={rec.address}>
                                                                    <i className="ri-map-pin-2-line" style={{ marginRight: 3 }} />
                                                                    {rec.address}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>— No OUT punch</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                                {wh ? (
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{wh}</span>
                                                ) : (
                                                    <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                                {statusBadge(rec?.approvalStatus)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Bottom spacer ── */}
            <div style={{ height: 72 }} />

            {/* ── Sticky Action Bar ── */}
            <div style={{
                position: 'sticky', bottom: 0,
                background: 'white', borderTop: '1px solid #e5e7eb',
                padding: '12px 20px',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 12,
                boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
                borderRadius: '0 0 12px 12px'
            }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                    {selectedIds.length > 0
                        ? <span style={{ color: '#be185d', fontWeight: 600 }}>
                            {selectedIds.length} punch-out record{selectedIds.length > 1 ? 's' : ''} selected
                          </span>
                        : 'Select punch-out records to approve or reject'
                    }
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => handleAction('Rejected')}
                        disabled={selectedIds.length === 0 || submitting}
                        style={{
                            padding: '9px 22px', borderRadius: 8, fontSize: 14,
                            border: '1.5px solid #fca5a5', background: 'transparent',
                            color: '#dc2626', fontWeight: 600,
                            cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
                            opacity: selectedIds.length > 0 ? 1 : 0.45
                        }}
                    >
                        Reject Selected
                    </button>
                    <button
                        onClick={() => handleAction('Approved')}
                        disabled={selectedIds.length === 0 || submitting}
                        style={{
                            padding: '9px 26px', borderRadius: 8, fontSize: 14,
                            background: selectedIds.length > 0 ? '#be185d' : '#f9a8d4',
                            border: 'none', color: 'white', fontWeight: 600,
                            cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', gap: 8,
                            opacity: submitting ? 0.7 : 1
                        }}
                    >
                        {submitting ? 'Processing…' : <><span>Approve Punch-Out</span><i className="ri-logout-box-line" /></>}
                    </button>
                </div>
            </div>

            {/* ── Zoom Modal Overlay ── */}
            {zoomPhoto && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.92)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        cursor: 'zoom-out'
                    }}
                    onClick={() => setZoomPhoto(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                        <img
                            src={zoomPhoto}
                            alt="HD View"
                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setZoomPhoto(null); }}
                            style={{
                                position: 'absolute', top: -40, right: -40,
                                background: 'white', border: 'none', borderRadius: '50%',
                                width: 36, height: 36, display: 'flex',
                                justifyContent: 'center', alignItems: 'center',
                                cursor: 'pointer', fontSize: 20, color: 'black'
                            }}
                        >
                            <i className="ri-close-line" />
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                tbody tr:hover td { background: #fff0f7 !important; }
            `}</style>
        </div>
    );
};

/* ── Tiny helpers ─────────────────────────────────────────────────────── */
const Pill = ({ bg, color, children }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 999,
        fontSize: 12, fontWeight: 600, background: bg, color
    }}>
        {children}
    </span>
);

const navBtn = {
    background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '7px 10px', cursor: 'pointer', display: 'flex',
    alignItems: 'center', color: '#374151', fontSize: 18
};

const th = {
    padding: '12px 16px', fontSize: 11, color: '#6b7280',
    textTransform: 'uppercase', fontWeight: 700,
    letterSpacing: '0.05em', textAlign: 'left'
};

const spinnerStyle = {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid #e5e7eb', borderTopColor: '#be185d',
    animation: 'spin 0.8s linear infinite'
};

export default AttendancePunchOutApproval;
