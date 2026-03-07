import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/AttendanceList.css";

export default function AttendanceList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

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
    attendanceType: "IN",
    deviceTime: "",
    latitude: "",
    longitude: "",
    address: ""
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

  // Initial load
  useEffect(() => {
    fetchRecords(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Add Attendance Handler
  const handleAddAttendance = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `/api/v1/attendance/mark`,
        newAttendance,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Attendance added successfully");
      setShowAddModal(false);
      setNewAttendance({
        userId: "",
        attendanceType: "IN",
        deviceTime: "",
        latitude: "",
        longitude: "",
        address: ""
      });
      fetchRecords(page, limit);
    } catch (err) {
      toast.error(err.response?.data?.message || "Error adding attendance");
    }
  };

  return (
    <div className="attendance-list-page">
      <div className="flex justify-between items-center mb-lg">
        <h2 style={{ margin: 0 }}>Attendance Records</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Attendance
        </button>
      </div>

      <div className="filter-row">
        <input
          type="text"
          className="form-control"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />

        <input
          type="date"
          className="form-control"
          placeholder="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ minWidth: "150px" }}
        />

        <input
          type="date"
          className="form-control"
          placeholder="End Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{ minWidth: "150px" }}
        />

        {selectedIds.length > 0 && (
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            Delete Selected ({selectedIds.length})
          </button>
        )}
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

                        {/* TYPE - Show both IN and OUT */}
                        <td>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {hasIn && (
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#dcfce7",
                                  color: "#166534",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                              >
                                IN
                              </span>
                            )}
                            {hasOut && (
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#fee2e2",
                                  color: "#991b1b",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                              >
                                OUT
                              </span>
                            )}
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
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor:
                                (r.outRecord?.status || r.inRecord?.status) === "Half Day"
                                  ? "#fef9c3"
                                  : (r.outRecord?.status || r.inRecord?.status) === "Absent"
                                    ? "#fee2e2"
                                    : (r.outRecord?.status || r.inRecord?.status) === "Full Day"
                                      ? "#dcfce7"
                                      : "#dcfce7",
                              color:
                                (r.outRecord?.status || r.inRecord?.status) === "Half Day"
                                  ? "#854d0e"
                                  : (r.outRecord?.status || r.inRecord?.status) === "Absent"
                                    ? "#991b1b"
                                    : "#166534",
                              fontSize: "12px",
                            }}
                          >
                            {r.outRecord?.status || r.inRecord?.status || "Present"}
                          </span>
                        </td>

                        {/* REMARKS */}
                        <td className="remarks-cell" title={r.outRecord?.remarks || r.inRecord?.remarks || "-"}>
                          {(() => {
                            const text = r.outRecord?.remarks || r.inRecord?.remarks || "-";
                            return text.length > 30 ? text.substring(0, 30) + '...' : text;
                          })()}
                        </td>

                        {/* ACTIONS (Only for Admin) */}
                        <td>
                          {userRole === "admin" && (
                            <>
                              <button
                                onClick={() => handleEdit(r)}
                                style={{
                                  marginRight: "5px",
                                  padding: "4px 8px",
                                  backgroundColor: "#f59e0b",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                style={{
                                  padding: "4px 8px",
                                  backgroundColor: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Delete
                              </button>
                            </>
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
          <div
            className="pager"
            style={{
              marginTop: 15,
              display: "flex",
              alignItems: "center",
              gap: 15,
            }}
          >
            <button onClick={handlePrev} disabled={page <= 1}>
              Prev
            </button>

            <span>
              Page {page} / {Math.max(1, Math.ceil(total / limit))}
            </span>

            <button
              onClick={handleNext}
              disabled={page >= Math.ceil(total / limit)}
            >
              Next
            </button>
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

      {/* ADD ATTENDANCE MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddAttendance}>
              <h3>Add Attendance</h3>

              <div className="form-group">
                <label className="form-label">User ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={newAttendance.userId}
                  onChange={(e) => setNewAttendance({ ...newAttendance, userId: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={newAttendance.attendanceType}
                  onChange={(e) => setNewAttendance({ ...newAttendance, attendanceType: e.target.value })}
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={newAttendance.deviceTime}
                  onChange={(e) => setNewAttendance({ ...newAttendance, deviceTime: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={newAttendance.latitude}
                  onChange={(e) => setNewAttendance({ ...newAttendance, latitude: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={newAttendance.longitude}
                  onChange={(e) => setNewAttendance({ ...newAttendance, longitude: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={newAttendance.address}
                  onChange={(e) => setNewAttendance({ ...newAttendance, address: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}
