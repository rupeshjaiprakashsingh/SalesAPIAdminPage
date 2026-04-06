import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

const AttendanceApproval = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    const [date, setDate] = useState(initialDate);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPendingAttendance = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/v1/attendance/list?startDate=${date}&endDate=${date}`);
            
            // Filter users who have at least one pending punch
            const pendingUsers = res.data.attendance.filter(userDay => {
                return (userDay.inRecord && userDay.inRecord.approvalStatus === 'Pending') ||
                       (userDay.outRecord && userDay.outRecord.approvalStatus === 'Pending');
            });

            setAttendance(pendingUsers);
        } catch (err) {
            toast.error("Failed to fetch pending attendance");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingAttendance();
    }, [date]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUserIds(attendance.map(a => a.userDetails._id));
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleSelectOne = (userId) => {
        if (selectedUserIds.includes(userId)) {
            setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
        } else {
            setSelectedUserIds([...selectedUserIds, userId]);
        }
    };

    const handleBulkAction = async (status) => {
        if (selectedUserIds.length === 0) {
            toast.warn("Please select at least one staff member");
            return;
        }

        const attendanceIdsToUpdate = [];
        attendance.forEach(userDay => {
            if (selectedUserIds.includes(userDay.userDetails._id)) {
                if (userDay.inRecord && userDay.inRecord.approvalStatus === 'Pending') {
                    attendanceIdsToUpdate.push(userDay.inRecord._id);
                }
                if (userDay.outRecord && userDay.outRecord.approvalStatus === 'Pending') {
                    attendanceIdsToUpdate.push(userDay.outRecord._id);
                }
            }
        });

        if (attendanceIdsToUpdate.length === 0) return;

        try {
            await axios.post('/api/v1/attendance/confirm-approval', {
                ids: attendanceIdsToUpdate,
                approvalStatus: status
            });
            toast.success(`Records ${status.toLowerCase()} successfully`);
            setSelectedUserIds([]);
            fetchPendingAttendance();
        } catch (err) {
            toast.error(`Error: ${err.response?.data?.message || err.message}`);
        }
    };

    const filteredAttendance = attendance.filter(a => 
        a.userDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderPunchCard = (record) => {
        if (!record) return <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>No punch data</div>;
        
        return (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {record.photoUrl ? (
                    <img 
                        src={record.photoUrl.startsWith('/') ? `${axios.defaults.baseURL || ''}${record.photoUrl}` : record.photoUrl} 
                        style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} 
                        alt="Selfie"
                    />
                ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="ri-user-line" style={{ color: '#9ca3af' }}></i>
                    </div>
                )}
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{new Date(record.deviceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.address}>
                        {record.address || "Location unavailable"}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '24px', background: '#f9fafb', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                    <i className="ri-arrow-left-line"></i>
                </button>
                <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111827' }}>Attendance Pending for Approval</h1>
            </div>

            {/* Filters */}
            <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', background: '#f9fafb' }}
                    />
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <i className="ri-search-line" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
                        <input 
                            type="text" 
                            placeholder="Search Staff" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Regular <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '8px' }}>{filteredAttendance.length}</span></h3>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                        <tr>
                            <th style={{ padding: '12px 16px', width: '40px' }}>
                                <input type="checkbox" checked={selectedUserIds.length === filteredAttendance.length && filteredAttendance.length > 0} onChange={handleSelectAll} />
                            </th>
                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Staff Name</th>
                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Punch In</th>
                            <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Punch Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
                        ) : filteredAttendance.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No pending approvals for this date.</td></tr>
                        ) : (
                            filteredAttendance.map(userDay => (
                                <tr key={userDay.userDetails._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px' }}>
                                        <input 
                                          type="checkbox" 
                                          checked={selectedUserIds.includes(userDay.userDetails._id)} 
                                          onChange={() => handleSelectOne(userDay.userDetails._id)} 
                                        />
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151' }}>{userDay.userDetails.name}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                            {userDay.outRecord?.workingHours ? `${userDay.outRecord.workingHours}h` : '--'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {renderPunchCard(userDay.inRecord)}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {renderPunchCard(userDay.outRecord)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sticky Actions */}
            <div style={{ 
                position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', 
                padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', 
                justifyContent: 'flex-end', gap: '12px' 
            }}>
                <button 
                    onClick={() => handleBulkAction('Rejected')}
                    disabled={selectedUserIds.length === 0}
                    style={{ 
                        padding: '10px 24px', borderRadius: '8px', border: '1px solid #fecaca', 
                        background: 'transparent', color: '#ef4444', fontWeight: 600, cursor: selectedUserIds.length > 0 ? 'pointer' : 'not-allowed',
                        opacity: selectedUserIds.length > 0 ? 1 : 0.5
                    }}
                >
                    Reject Selected
                </button>
                <button 
                    onClick={() => handleBulkAction('Approved')}
                    disabled={selectedUserIds.length === 0}
                    style={{ 
                        padding: '10px 24px', borderRadius: '30px', border: 'none', 
                        background: '#3b82f6', color: 'white', fontWeight: 600, cursor: selectedUserIds.length > 0 ? 'pointer' : 'not-allowed',
                        opacity: selectedUserIds.length > 0 ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    Approve Selected <i className="ri-check-line"></i>
                </button>
            </div>
            <div style={{ height: '80px' }}></div> {/* Spacer */}
        </div>
    );
};

export default AttendanceApproval;
