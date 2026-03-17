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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
        `/api/v1/attendance/list?page=${p}&limit=${l}`,
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

  // Initial load
  useEffect(() => {
    // Optionally default to today's date if empty initially, but let's just fetch
    fetchRecords(1, limit);
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Apply search + filters on UI (not API)
  const filtered = records.filter((r) => {
    const matchesName =
      r.userDetails?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.userDetails?.email?.toLowerCase().includes(search.toLowerCase());

    // For type filter with merged records
    let matchesType = true;
    if (typeFilter === "IN") {
      matchesType = r.inRecord != null;
    } else if (typeFilter === "OUT") {
      matchesType = r.outRecord != null;
    }

    // Date range filter
    let matchesDate = true;
    if (startDate || endDate) {
      const recordDate = r.dateStr;
      if (startDate && recordDate < startDate) matchesDate = false;
      if (endDate && recordDate > endDate) matchesDate = false;
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

  return (
    <div className="attendance-list-page">
      {/* COMPACT HEADER — single row */}
      <div style={{ background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          
          {/* Left: title + search + filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea', flexShrink: 0 }}>
                <i className="ri-user-3-fill" style={{ fontSize: '13px' }}></i>
              </div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>Daily Attendance View</h3>
            </div>
            <div style={{ position: 'relative' }}>
              <i className="ri-search-line" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '13px' }}></i>
              <input
                type="text"
                placeholder="Search by Name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '200px', padding: '6px 10px 6px 30px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', color: '#374151', fontSize: '0.8rem' }}
              />
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
              <i className="ri-filter-3-fill"></i> Filter
            </button>
            {/* Hidden date input for override */}
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value); }} style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', width: '1px', height: '1px' }} />
          </div>

          {/* Right: date nav + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#4b5563', fontSize: '0.8rem' }}>
               <i className="ri-arrow-left-s-line" style={{ cursor: 'pointer', fontSize: '1rem' }} onClick={() => handleDateChange(-1)}></i>
               <span style={{ minWidth: '80px', textAlign: 'center' }}>{getFormattedDate()}</span>
               <i className="ri-arrow-right-s-line" style={{ cursor: 'pointer', fontSize: '1rem' }} onClick={() => handleDateChange(1)}></i>
               <i className="ri-calendar-line" style={{ color: '#9ca3af', fontSize: '1rem', cursor: 'pointer' }}></i>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: 'white', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
              <i className="ri-download-2-line"></i> Download
            </button>
            <i className="ri-settings-3-line" style={{ cursor: 'pointer', color: '#3b82f6', fontSize: '1.1rem' }}></i>
            {userRole === "admin" && (
              <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="ri-add-line"></i> Add
              </button>
            )}
            {selectedIds.length > 0 && userRole === "admin" && (
              <button onClick={handleBulkDelete} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                <i className="ri-delete-bin-line"></i> ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* TABLE */}
          <div className="table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>
                    {userRole === "admin" && (
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      />
                    )}
                  </th>
                  {userRole === "admin" && <th>Name</th>}
                  <th>Date</th>
                  <th>Type</th>
                  <th>Device ID</th>
                  <th>In Address</th>
                  <th>Out Address</th>
                  <th>IN Time</th>
                  <th>OUT Time</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center" }}>
                      No records found
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const rowKey = `${r.userId}_${r.dateStr}`;
                    const hasIn = r.inRecord != null;
                    const hasOut = r.outRecord != null;

                    return (
                      <tr key={rowKey}>
                        <td>
                          {userRole === "admin" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(rowKey)}
                              onChange={(e) => handleSelectOne(e, rowKey)}
                            />
                          )}
                        </td>
                        {/* NAME → CLICKABLE LINK (Only for Admin) */}
                        {userRole === "admin" && (
                          <td className="name-cell">
                            <Link
                              to={`/dashboard/attendance/${r.userId}?date=${r.dateStr}`}
                              style={{
                                color: "#2563eb",
                                textDecoration: "underline",
                                fontWeight: "500",
                              }}
                            >
                              {r.userDetails?.name || "-"}
                            </Link>
                          </td>
                        )}

                        {/* DATE */}
                        <td className="date-cell">{r.dateStr}</td>

                        {/* TYPE */}
                        <td>
                          <div style={{ display: "flex", gap: "4px", flexDirection: "column" }}>
                            {hasIn  && <span className="badge-in">IN</span>}
                            {hasOut && <span className="badge-out">OUT</span>}
                          </div>
                        </td>

                        {/* DEVICE ID */}
                        <td className="device-id-cell">
                          <span title={r.inRecord?.deviceId || r.outRecord?.deviceId || "-"}>
                            {r.inRecord?.deviceId || r.outRecord?.deviceId || "-"}
                          </span>
                        </td>

                        {/* IN ADDRESS */}
                        <td className="address-cell" title={r.inRecord?.address || "-"}>
                          {r.inRecord?.address || "-"}
                        </td>

                        {/* OUT ADDRESS */}
                        <td className="address-cell" title={r.outRecord?.address || "-"}>
                          {r.outRecord?.address || "-"}
                        </td>

                        {/* IN TIME */}
                        <td className="time-cell">
                          {r.inRecord?.deviceTime
                            ? new Date(r.inRecord.deviceTime).toLocaleTimeString()
                            : "-"}
                        </td>

                        {/* OUT TIME */}
                        <td className="time-cell">
                          {r.outRecord?.deviceTime
                            ? new Date(r.outRecord.deviceTime).toLocaleTimeString()
                            : "-"}
                        </td>

                        {/* WORKING HOURS */}
                        <td>
                          {r.outRecord?.workingHours
                            ? (() => {
                              const decimal = parseFloat(r.outRecord.workingHours);
                              let hrs = Math.floor(decimal);
                              let mins = Math.round((decimal - hrs) * 60);
                              if (mins === 60) {
                                hrs += 1;
                                mins = 0;
                              }
                              return `${hrs}:${mins.toString().padStart(2, '0')} hrs`;
                            })()
                            : "-"}
                        </td>

                        {/* STATUS */}
                        <td>
                          {(() => {
                            const st = r.outRecord?.status || r.inRecord?.status || "Present";
                            const cls = st === "Half Day" ? "status-halfday"
                              : st === "Absent"   ? "status-absent"
                              : st === "Full Day" ? "status-fullday"
                              : "status-present";
                            return <span className={`status-pill ${cls}`}>{st}</span>;
                          })()}
                        </td>

                        {/* REMARKS */}
                        <td className="remarks-cell" title={r.outRecord?.remarks || r.inRecord?.remarks || "-"}>
                          {(() => {
                            const text = r.outRecord?.remarks || r.inRecord?.remarks || "-";
                            return text.length > 30 ? text.substring(0, 30) + '...' : text;
                          })()}
                        </td>

                        {/* ACTIONS */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {userRole === "admin" && (
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button className="action-btn action-btn-edit" onClick={() => handleEdit(r)}>
                                ✎ Edit
                              </button>
                              <button className="action-btn action-btn-delete" onClick={() => handleDelete(r)}>
                                ✕ Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="pager">
            <button onClick={handlePrev} disabled={page <= 1}>Prev</button>
            <span>Page {page} / {Math.max(1, Math.ceil(total / limit))}</span>
            <button onClick={handleNext} disabled={page >= Math.ceil(total / limit)}>Next</button>
          </div>
        </>
      )
      }

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
