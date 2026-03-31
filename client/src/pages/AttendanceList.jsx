import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/AttendanceList.css";

export default function AttendanceList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  // pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  // filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const getTodayStr = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  // Add Attendance Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAttendance, setNewAttendance] = useState({
    userId: "",
    status: "Present",   // Present | Half Day | Absent
    date: "",            // YYYY-MM-DD, blank = today
    remarks: ""
  });

  const token =
    JSON.parse(localStorage.getItem("auth")) ||
    localStorage.getItem("token") ||
    "";

  // Selection state
  const [selectedIds, setSelectedIds] = useState([]);

  // User Role State
  const [userRole, setUserRole] = useState("user");

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || "user");
      } catch (e) {
        console.error("Error decoding token", e);
      }
    }
  }, [token]);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // API CALL
  const fetchRecords = async (p = page, l = limit) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `/api/v1/attendance/list?page=${p}&limit=${l}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data) {
        setRecords(res.data.records || []);
        setTotal(res.data.total || 0);
        setPage(res.data.page || p);
        setLimit(res.data.limit || l);
        setSelectedIds([]); // Reset selection on fetch
      }
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to load attendance records";
      toast.error(msg);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get("/api/v1/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && res.data.users) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error("Failed to load users for dropdown", err);
    }
  };

  // Load and reload on date change
  useEffect(() => {
    fetchRecords(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
     fetchUsers();
  }, []);

  // Helper: Arrow Pagination for Date
  const handleDateChange = (days) => {
    const baseDate = startDate ? new Date(startDate) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const newDateStr = baseDate.toISOString().split("T")[0];
    setStartDate(newDateStr);
    setEndDate(newDateStr);
  };

  const getFormattedDate = () => {
    if (!startDate && !endDate) return "All Time";
    const getTodayStr2 = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; };
    if (startDate === endDate && startDate === getTodayStr2()) {
        return "Today, " + new Date(startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    if (startDate === endDate || (startDate && !endDate)) {
      return new Date(startDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    }
    return "Range Selected";
  };

  // Pagination
  const handlePrev = () => {
    if (page > 1) fetchRecords(page - 1, limit);
  };

  const handleNext = () => {
    const maxPage = Math.ceil(total / limit) || 1;
    if (page < maxPage) fetchRecords(page + 1, limit);
  };

  // Page size update
  const handleLimitChange = (e) => {
    const newLimit = Number(e.target.value);
    setLimit(newLimit);
    fetchRecords(1, newLimit);
  };

  // Apply map & merge logic if single date is selected
  const isSingleDate = startDate && endDate && startDate === endDate;
  let baseArray = records;

  if (isSingleDate && users.length > 0) {
    baseArray = users.map(user => {
      const existing = records.find(r => (r.userId === user._id || r.userId === user.id) && r.dateStr === startDate);
      if (existing) return existing;

      return {
        userId: user._id || user.id,
        dateStr: startDate,
        userDetails: user,
        inRecord: null,
        outRecord: null,
        dummy: true
      };
    });
  }

  const filtered = baseArray.filter((r) => {
    const nameStr = r.userDetails?.name || "";
    const emailStr = r.userDetails?.email || "";
    const matchesName = nameStr.toLowerCase().includes(search.toLowerCase()) || emailStr.toLowerCase().includes(search.toLowerCase());

    let matchesType = true;
    if (typeFilter === "IN") matchesType = r.inRecord != null;
    else if (typeFilter === "OUT") matchesType = r.outRecord != null;

    let matchesDate = true;
    if (!isSingleDate && (startDate || endDate)) {
      if (startDate && r.dateStr < startDate) matchesDate = false;
      if (endDate && r.dateStr > endDate) matchesDate = false;
    }

    return matchesName && matchesType && matchesDate;
  });

  // Handle Checkbox Selection (for merged records, we'll use dateStr + userId as key)
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = filtered.map((r) => `${r.userId}_${r.dateStr}`);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Bulk Delete (collect all IN and OUT record IDs from selected merged rows)
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} day(s) of records?`)) return;

    try {
      // Collect all record IDs from selected merged rows
      const recordIds = [];
      selectedIds.forEach(key => {
        const record = filtered.find(r => `${r.userId}_${r.dateStr}` === key);
        if (record) {
          if (record.inRecord?._id) recordIds.push(record.inRecord._id);
          if (record.outRecord?._id) recordIds.push(record.outRecord._id);
        }
      });

      await axios.post(
        "/api/v1/attendance/delete-multiple",
        { ids: recordIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Records deleted successfully");
      fetchRecords(page, limit);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error deleting records");
    }
  };

  // Single Delete (delete both IN and OUT for the day)
  const handleDelete = async (record) => {
    if (!window.confirm("Are you sure you want to delete this day's attendance?")) return;
    try {
      const idsToDelete = [];
      if (record.inRecord?._id) idsToDelete.push(record.inRecord._id);
      if (record.outRecord?._id) idsToDelete.push(record.outRecord._id);

      await axios.post(
        "/api/v1/attendance/delete-multiple",
        { ids: idsToDelete },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Record deleted successfully");
      fetchRecords(page, limit);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error deleting record");
    }
  };

  // Edit Logic (edit the OUT record if exists, otherwise IN)
  const handleEdit = (record) => {
    const recordToEdit = record.outRecord || record.inRecord;
    if (recordToEdit) {
      setEditingRecord({ ...recordToEdit });
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRecord?._id) return;

    try {
      await axios.put(
        `/api/v1/attendance/${editingRecord._id}`,
        editingRecord,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Record updated successfully");
      setShowEditModal(false);
      fetchRecords(page, limit);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating record");
    }
  };

  // Add Attendance Handler — uses admin-only endpoint, no device/location required
  const handleAddAttendance = async (e) => {
    e.preventDefault();
    if (!newAttendance.userId) {
      toast.error("Please select a staff member.");
      return;
    }
    try {
      const payload = {
        userId: newAttendance.userId,
        status: newAttendance.status,
        date: newAttendance.date || undefined,   // blank → backend uses today
        remarks: newAttendance.remarks || undefined
      };
  const handleQuickMark = async (userId, status, date) => {
    if (userRole !== 'admin') return;
    try {
      const payload = {
        userId,
        status,
        date,
        remarks: "Quick Marked from Dashboard"
      };
      await axios.post(`/api/v1/attendance/admin-add`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Marked as ${status}`);
      fetchRecords(page, limit);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error marking attendance");
    }
  };

      await axios.post(
        `/api/v1/attendance/admin-add`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Attendance added successfully");
      setShowAddModal(false);
      setNewAttendance({ userId: "", status: "Present", date: "", remarks: "" });
      fetchRecords(page, limit);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error adding attendance");
    }
  };


  const statTotalStaff = users.length;
  const statPresentCount = filtered.filter(f => { const s = f.outRecord?.status || f.inRecord?.status; return s === "Present" || s === "Full Day"; }).length;
  const statAbsentCount = filtered.filter(f => { const s = f.outRecord?.status || f.inRecord?.status; return s === "Absent"; }).length;
  const statHalfDayCount = filtered.filter(f => { const s = f.outRecord?.status || f.inRecord?.status; return s === "Half Day"; }).length;
  const statInCount = filtered.filter(f => f.inRecord).length;
  const statOutCount = filtered.filter(f => f.outRecord).length;

  return (
    <div className="attendance-list-page" style={{ padding: '0px', background: '#f9fafb', height: '100%', flex: 1, overflowY: 'auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '15px 20px', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>Attendance Summary</h2>
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
          {userRole === "admin" && selectedIds.length > 0 && (
             <span style={{ cursor: 'pointer', color: '#ef4444' }} onClick={handleBulkDelete}>
               <i className="ri-delete-bin-line"></i> Delete ({selectedIds.length})
             </span>
          )}
          <span style={{ cursor: 'pointer' }}><i className="ri-error-warning-line"></i> Unprocessed Logs</span>
          <span style={{ cursor: 'pointer' }}><i className="ri-download-2-line"></i> Daily Report</span>
          <span style={{ cursor: 'pointer' }}><i className="ri-settings-3-line"></i> Settings</span>
        </div>
      </div>

      {/* Top Summary Card */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px', margin: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '14px', fontWeight: 600, color: '#374151', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}>
            <i className="ri-arrow-left-s-line" style={{ cursor: 'pointer', fontSize: '16px' }} onClick={() => handleDateChange(-1)}></i>
            <span>{getFormattedDate()}</span>
            <i className="ri-calendar-line" style={{ color: '#9ca3af', marginLeft: '5px' }}></i>
            <i className="ri-arrow-right-s-line" style={{ cursor: 'pointer', fontSize: '16px' }} onClick={() => handleDateChange(1)}></i>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}><span style={{ color: '#ef4444' }}>●</span> Total Pending for Approval : 0</span>
            <button style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Review</button>
          </div>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value); }} style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }} />
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '40px', overflowX: 'auto', paddingBottom: '20px', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb', marginBottom: '20px' }}>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Total Staff <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>{statTotalStaff}</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Present <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>{statPresentCount}</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Absent <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>{statAbsentCount}</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Half Day <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>{statHalfDayCount}</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Overtime Hours <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>0h 0m</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Fine hours <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>0h 0m</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Leave <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>0</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Punched In <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>{statInCount}</div></div>
          <div><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Punched Out <i className="ri-information-line"></i></div><div style={{ fontSize: '18px', fontWeight: 700 }}>{statOutCount}</div></div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '30px', fontSize: '14px', fontWeight: 600, color: '#2563eb' }}>
          {userRole === "admin" && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowAddModal(true)}>
               <i className="ri-group-line" style={{ fontSize: '18px' }}></i> Bulk Add Attendance
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
             <i className="ri-briefcase-4-line" style={{ fontSize: '18px' }}></i> Bulk Add Work (Work Basis)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
             <i className="ri-money-rupee-circle-line" style={{ fontSize: '18px' }}></i> Fine
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '15px', margin: '0 20px 30px 20px' }}>
         <div style={{ position: 'relative', width: '400px' }}>
            <i className="ri-search-line" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
            <input 
               type="text" 
               placeholder="Search Staff by Name, Phone Number or" 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               style={{ width: '100%', padding: '12px 15px 12px 40px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }} 
            />
         </div>
         <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
            <i className="ri-filter-3-fill"></i> Filter
         </button>
      </div>

      {/* List Subtitle */}
      <div style={{ margin: '0 20px 15px 20px', fontSize: '15px', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '10px' }}>
         Monthly Regular 
         <span style={{ background: '#e5e7eb', padding: '2px 10px', borderRadius: '12px', fontSize: '13px', color: '#4b5563' }}>{filtered.length}</span>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
      ) : (
        <div style={{ margin: '0 20px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>No records found</div>
          ) : (
            filtered.map((r) => {
              const rowKey = `${r.userId}_${r.dateStr}`;
              const st = r.outRecord?.status || r.inRecord?.status;
              const isPresent = st === "Present" || st === "Full Day";
              const isAbsent = st === "Absent";
              const isHalfDay = st === "Half Day";
              
              let inTimeStr = "-";
              if (r.inRecord?.deviceTime) {
                inTimeStr = new Date(r.inRecord.deviceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              }
              let outTimeStr = "-";
              if (r.outRecord?.deviceTime) {
                outTimeStr = new Date(r.outRecord.deviceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              }
              
              let hrsStr = "- Hrs";
              if (r.outRecord?.workingHours) {
                const decimal = parseFloat(r.outRecord.workingHours);
                let hrs = Math.floor(decimal);
                let mins = Math.round((decimal - hrs) * 60);
                if (mins === 60) { hrs += 1; mins = 0; }
                hrsStr = `${hrs}:${mins.toString().padStart(2, '0')} Hrs`;
              }

              return (
                <div key={rowKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', marginBottom: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  {/* Left Section */}
                  <div style={{ display: 'flex', gap: '15px' }}>
                     {/* No Checkbox by default unless admin, optionally hidden for now or keep */}
                     {userRole === "admin" && (
                        <div style={{ paddingTop: '2px' }}>
                           <input type="checkbox" checked={selectedIds.includes(rowKey)} onChange={(e) => handleSelectOne(e, rowKey)} style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }} />
                        </div>
                     )}
                     <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '8px', textTransform: 'uppercase' }}>
                           {userRole === "admin" ? (
                              <Link to={`/dashboard/attendance/${r.userId}?date=${r.dateStr}`} style={{ color: '#111827', textDecoration: 'none' }}>
                                 {r.userDetails?.name || "-"}
                              </Link>
                           ) : (
                              r.userDetails?.name || "-"
                           )}
                           <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '8px', textTransform: 'none' }}>{r.userDetails?.employeeId || `EP-S-${r.userId.slice(-3)}`}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '4px', fontWeight: 500 }}>
                           {hrsStr}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                           1 Shift (s) <i className="ri-information-line"></i>
                        </div>
                        <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600, display: 'flex', gap: '10px' }}>
                           <span style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)}>Add Note - Logs (Edit)</span>
                           {userRole === "admin" && (
                              <span style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDelete(r)}>Delete</span>
                           )}
                        </div>
                     </div>
                  </div>

                  
                  {/* Right Section (Status Grid) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '400px' }}>
                     <div 
                        onClick={() => handleQuickMark(r.userId, 'Present', r.dateStr)}
                        style={{ 
                           background: isPresent ? '#dcfce7' : '#f9fafb', 
                           border: isPresent ? '1px solid #16a34a' : '1px solid #e5e7eb', 
                           padding: '10px 15px', borderRadius: '6px', fontSize: '13px', 
                           color: isPresent ? '#166534' : '#6b7280', 
                           fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                           cursor: userRole === 'admin' ? 'pointer' : 'default',
                           transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => userRole === 'admin' && (e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)')}
                        onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                     >
                        <strong style={{ color: isPresent ? '#16a34a' : '#374151' }}>P |</strong> {isPresent ? `${inTimeStr} - ${outTimeStr}` : 'Present'}
                     </div>
                     <div 
                        onClick={() => handleQuickMark(r.userId, 'Half Day', r.dateStr)}
                        style={{ 
                           background: isHalfDay ? '#fef9c3' : '#f9fafb', 
                           border: isHalfDay ? '1px solid #eab308' : '1px solid #e5e7eb', 
                           padding: '10px 15px', borderRadius: '6px', fontSize: '13px', 
                           color: isHalfDay ? '#854d0e' : '#6b7280', 
                           fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                           cursor: userRole === 'admin' ? 'pointer' : 'default',
                           transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => userRole === 'admin' && (e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)')}
                        onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                     >
                        <strong style={{ color: isHalfDay ? '#eab308' : '#374151' }}>HD |</strong> Half Day
                     </div>
                     <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '10px 15px', borderRadius: '6px', fontSize: '13px', color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#374151' }}>F |</strong> Fine
                     </div>
                     <div 
                        onClick={() => handleQuickMark(r.userId, 'Absent', r.dateStr)}
                        style={{ 
                           background: isAbsent ? '#fee2e2' : '#f9fafb', 
                           border: isAbsent ? '1px solid #dc2626' : '1px solid #e5e7eb', 
                           padding: '10px 15px', borderRadius: '6px', fontSize: '13px', 
                           color: isAbsent ? '#991b1b' : '#6b7280', 
                           fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                           cursor: userRole === 'admin' ? 'pointer' : 'default',
                           transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => userRole === 'admin' && (e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)')}
                        onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
                     >
                        <strong style={{ color: isAbsent ? '#dc2626' : '#374151' }}>A |</strong> Absent
                     </div>
                     <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '10px 15px', borderRadius: '6px', fontSize: '13px', color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#374151' }}>OT |</strong> Overtime
                     </div>
                     <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '10px 15px', borderRadius: '6px', fontSize: '13px', color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#374151' }}>L |</strong> Leave
                     </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '20px' }}>
        <button onClick={handlePrev} disabled={page <= 1} style={{ padding: '8px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Prev</button>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Page {page} / {Math.max(1, Math.ceil(total / limit))}</span>
        <button onClick={handleNext} disabled={page >= Math.ceil(total / limit)} style={{ padding: '8px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: page >= Math.ceil(total / limit) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Next</button>
      </div>


      {/* Edit Modal */}
      {
        showEditModal && editingRecord && (
          <div className="modal-overlay" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
          }}>
            <div className="modal-content" style={{
              backgroundColor: "white", padding: "20px", borderRadius: "8px", width: "400px", maxWidth: "90%"
            }}>
              <h3>Edit Attendance</h3>
              <form onSubmit={handleSaveEdit}>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>Type</label>
                  <select
                    value={editingRecord.attendanceType}
                    onChange={(e) => setEditingRecord({ ...editingRecord, attendanceType: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </select>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>Time</label>
                  <input
                    type="datetime-local"
                    value={editingRecord.deviceTime ? new Date(editingRecord.deviceTime).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, deviceTime: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                  />
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>Status</label>
                  <select
                    value={editingRecord.status || "Present"}
                    onChange={(e) => setEditingRecord({ ...editingRecord, status: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                  >
                    <option value="Present">Present</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px" }}>Working Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingRecord.workingHours || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, workingHours: parseFloat(e.target.value) })}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{ padding: "8px 16px", backgroundColor: "#9ca3af", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: "8px 16px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* ADD ATTENDANCE MODAL — simplified: user + status only */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddAttendance}>
              <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#111827' }}>Add Attendance</h3>

              {/* Info Banner */}
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px',
                padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#1e40af'
              }}>
                ℹ️ Select a staff member and their attendance status. All other details (time, location, working hours) will be filled automatically.
              </div>

              {/* Staff Member */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Staff Member <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={newAttendance.userId}
                  onChange={(e) => setNewAttendance({ ...newAttendance, userId: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  <option value="">— Select a Staff Member —</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Attendance Status <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['Present', 'Half Day', 'Absent'].map((s) => (
                    <label
                      key={s}
                      style={{
                        flex: 1, textAlign: 'center', padding: '10px 6px',
                        border: `2px solid ${
                          newAttendance.status === s
                            ? s === 'Present' ? '#16a34a' : s === 'Half Day' ? '#d97706' : '#dc2626'
                            : '#e5e7eb'
                        }`,
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        backgroundColor: newAttendance.status === s
                          ? s === 'Present' ? '#dcfce7' : s === 'Half Day' ? '#fef9c3' : '#fee2e2'
                          : 'white',
                        color: newAttendance.status === s
                          ? s === 'Present' ? '#166534' : s === 'Half Day' ? '#854d0e' : '#991b1b'
                          : '#374151',
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={newAttendance.status === s}
                        onChange={(e) => setNewAttendance({ ...newAttendance, status: e.target.value })}
                        style={{ display: 'none' }}
                      />
                      {s === 'Present' ? '✅' : s === 'Half Day' ? '🕑' : '❌'} {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Date (optional) */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Date <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — defaults to today)</span>
                </label>
                <input
                  type="date"
                  value={newAttendance.date}
                  onChange={(e) => setNewAttendance({ ...newAttendance, date: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              {/* Remarks (optional) */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Remarks <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. On leave, WFH, etc."
                  value={newAttendance.remarks}
                  onChange={(e) => setNewAttendance({ ...newAttendance, remarks: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setNewAttendance({ userId: '', status: 'Present', date: '', remarks: '' }); }}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  ✔ Add Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}
