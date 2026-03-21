import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "../styles/AttendanceProfile.css";
import {
  GoogleMap,
  Marker,
  Polyline,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";

export default function GetAttendanceByIdDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = new URLSearchParams(window.location.search);
  const initialDate = query.get("date") || new Date().toISOString().split("T")[0];
  const initialMonth = initialDate.substring(0, 7); // YYYY-MM
  
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal logic for logs
  const [showLogs, setShowLogs] = useState(null);

  // Tab State
  const [activeTab, setActiveTab] = useState("daily");

  const token =
    JSON.parse(localStorage.getItem("auth")) ||
    localStorage.getItem("token") ||
    "";

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const fetchMonthlyData = async (m) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/v1/attendance/monthly/${id}?month=${m}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch monthly attendance");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMonthlyData(month);
  }, [id, month, token]);

  const changeMonth = (offset) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(newMonth);
  };

  if (loading) return <div style={{padding: '40px'}}>Loading Profile...</div>;
  if (!data) return <div style={{padding: '40px'}}>No Data Found</div>;

  const { user, records } = data;

  const [y, mStr] = month.split("-");
  const daysInMonth = new Date(y, Number(mStr), 0).getDate();
  
  // Find up to what day we should show the list (prevent showing empty future days)
  const today = new Date();
  let maxDayToShow = daysInMonth;
  if (Number(y) === today.getFullYear() && Number(mStr) === (today.getMonth() + 1)) {
    maxDayToShow = today.getDate(); // Stop at today for current month
  } else if (Number(y) > today.getFullYear() || (Number(y) === today.getFullYear() && Number(mStr) > (today.getMonth() + 1))) {
    maxDayToShow = 0; // Future months have no current past days
  }

  // If there happen to be any records explicitly marked in the future within this month, extend maxDayToShow
  records.forEach(r => {
    if (r.date.startsWith(`${y}-${mStr}-`)) {
      const recDay = parseInt(r.date.split("-")[2], 10);
      if (recDay > maxDayToShow) maxDayToShow = recDay;
    }
  });

  const daysList = [];
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let leaves = 0;
  let punchedIn = 0;
  let punchedOut = 0;

  for (let d = maxDayToShow; d >= 1; d--) {
    const dateStr = `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    const record = records.find(r => r.date === dateStr);
    
    const dateObj = new Date(dateStr);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const formattedDate = `${String(d).padStart(2, '0')} ${dateObj.toLocaleDateString("en-US", { month: "short" })} | ${dayName}`;

    let status = "Not Marked";
    let inStr = "";
    let outStr = "";
    let hrs = "";

    if (record) {
      const IN = record.in;
      const OUT = record.out;
      
      if (IN) {
        punchedIn++;
        inStr = new Date(IN.deviceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        status = IN.status || "Present";
      }
      if (OUT) {
        punchedOut++;
        outStr = new Date(OUT.deviceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        status = OUT.status || status;
        if (OUT.workingHours) {
          hrs = `${parseFloat(OUT.workingHours).toFixed(2)} Hrs`;
        }
      }

      if (status === "Present" || status === "Full Day") presentDays++;
      else if (status === "Half Day") halfDays++;
      else if (status === "Absent") absentDays++;
      else leaves++;
    }

    daysList.push({
      dateStr,
      formattedDate,
      record,
      status,
      inStr,
      outStr,
      hrs
    });
  }

  const monthDate = new Date(`${month}-01`);
  const monthTitle = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const renderMapLog = () => {
     if (!showLogs || !isLoaded) return null;
     const IN = showLogs.record?.in;
     const OUT = showLogs.record?.out;

     let inPos = IN ? { lat: IN.latitude, lng: IN.longitude } : null;
     let outPos = OUT ? { lat: OUT.latitude, lng: OUT.longitude } : null;

     if (inPos && outPos && inPos.lat === outPos.lat && inPos.lng === outPos.lng) {
       outPos = { lat: outPos.lat + 0.0002, lng: outPos.lng + 0.0002 };
     }

     const pathPoints = [inPos, outPos].filter(Boolean);

     return (
       <div className="modal-overlay" onClick={() => setShowLogs(null)}>
         <div className="modal-content" onClick={e => e.stopPropagation()}>
           <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px'}}>
             <h3 style={{margin: 0}}>Logs for {showLogs.formattedDate}</h3>
             <button onClick={() => setShowLogs(null)} style={{background:'none', border:'none', fontSize:'18px', cursor:'pointer'}}>✕</button>
           </div>
           
           <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ width: "300px", fontSize: "14px", lineHeight: '1.6' }}>
                 <p><b>Check In:</b> {showLogs.inStr || "N/A"}</p>
                 {IN && <p style={{color:'#6b7280', fontSize:'12px'}}>{IN.address}</p>}
                 <p><b>Check Out:</b> {showLogs.outStr || "N/A"}</p>
                 {OUT && <p style={{color:'#6b7280', fontSize:'12px'}}>{OUT.address}</p>}
                 <p><b>Working:</b> {showLogs.hrs}</p>
                 <p><b>Status:</b> {showLogs.status}</p>
              </div>
              <div style={{flex: 1, height: '400px', background:'#f3f4f6', borderRadius: '8px', overflow: 'hidden'}}>
                 {inPos || outPos ? (
                   <GoogleMap
                      mapContainerStyle={{ width: "100%", height: "100%" }}
                      center={inPos || outPos || { lat: 20.5937, lng: 78.9629 }}
                      zoom={15}
                      options={{ streetViewControl: false, mapTypeControl: false }}
                   >
                      {inPos && <Marker position={inPos} label="IN" />}
                      {outPos && <Marker position={outPos} label="OUT" />}
                      {pathPoints.length >= 2 && (
                         <Polyline path={pathPoints} options={{ strokeColor: "#0000FF", strokeWeight: 3 }} />
                      )}
                   </GoogleMap>
                 ) : (
                   <div style={{height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af'}}>
                      No location data available
                   </div>
                 )}
              </div>
           </div>
         </div>
       </div>
     );
  };

  // --- CALENDAR LOGIC ---
  const calendarCells = [];
  const firstDay = new Date(Number(y), Number(mStr) - 1, 1).getDay(); // 0 is Sunday
  
  for(let i=0; i<firstDay; i++) {
    calendarCells.push({ empty: true, key: `empty-start-${i}` });
  }

  const isCurrentMonth = Number(y) === today.getFullYear() && Number(mStr) === (today.getMonth() + 1);

  for(let d=1; d<=daysInMonth; d++) {
    const dateStr = `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    const record = records.find(r => r.date === dateStr);
    
    let calStatus = "Not Marked";
    let statusClass = "";
    let shortName = "";
    
    if (record) {
      const IN = record.in;
      const OUT = record.out;
      calStatus = OUT?.status || IN?.status || "Present";
    }

    if (calStatus === "Present" || calStatus === "Full Day") {
      statusClass = "p"; shortName = "P"; calStatus = "Present";
    } else if (calStatus === "Half Day") {
      statusClass = "hd"; shortName = "HD";
    } else if (calStatus === "Absent") {
      statusClass = "a"; shortName = "A";
    } else if (calStatus === "Weekly Off") {
      statusClass = "wo"; shortName = "WO";
    } else if (calStatus === "Paid Leave") {
      statusClass = "pl"; shortName = "PL";
    } else if (calStatus === "Leave") {
      statusClass = "l"; shortName = "L";
    }

    const isToday = isCurrentMonth && d === today.getDate();

    calendarCells.push({
      empty: false,
      date: d,
      key: `day-${d}`,
      isToday,
      status: calStatus,
      statusClass,
      shortName
    });
  }

  const remaining = calendarCells.length % 7;
  if (remaining !== 0) {
    for(let i=0; i<7 - remaining; i++) {
      calendarCells.push({ empty: true, key: `empty-end-${i}` });
    }
  }

  return (
    <div className="profile-attendance-page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <i className="ri-arrow-left-line"></i> Back
      </button>

      <div className="profile-attendance-header">
        <div>
          <h2 className="profile-title">
            {user?.name?.toUpperCase() || "STAFF"} 
            <span className="profile-handle">@{user?.employee_id || user?.email?.split('@')[0] || "staff"}</span>
          </h2>
        </div>
        <button className="download-report-btn">Download Report</button>
      </div>

      <div className="month-nav-container">
        <div className="month-nav">
          <i className="ri-arrow-left-s-line" onClick={() => changeMonth(-1)}></i>
          <span>{monthTitle}</span>
          <i className="ri-arrow-right-s-line" onClick={() => changeMonth(1)}></i>
          <i className="ri-calendar-line" style={{marginLeft: '8px', fontSize:'16px'}}></i>
        </div>
        <div className="all-approved">
          <i className="ri-checkbox-circle-fill" style={{fontSize: '16px'}}></i> All Approved
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-item">
          <span>Days <i className="ri-information-line"></i></span>
          <span>{daysInMonth}</span>
        </div>
        <div className="stat-item">
          <span>Present <i className="ri-information-line"></i></span>
          <span>{presentDays}</span>
        </div>
        <div className="stat-item">
          <span>Absent <i className="ri-information-line"></i></span>
          <span>{absentDays}</span>
        </div>
        <div className="stat-item">
          <span>Half Day <i className="ri-information-line"></i></span>
          <span>{halfDays}</span>
        </div>
        <div className="stat-item">
          <span>Leave <i className="ri-information-line"></i></span>
          <span>{leaves}</span>
        </div>
        <div className="stat-item">
          <span>Punched In <i className="ri-information-line"></i></span>
          <span>{punchedIn}</span>
        </div>
        <div className="stat-item">
          <span>Punched Out <i className="ri-information-line"></i></span>
          <span>{punchedOut}</span>
        </div>
        <div className="sms-toggle">
          Send Absent SMS to Staff
          <div className="toggle-switch"></div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${activeTab === "daily" ? "active" : ""}`} onClick={() => setActiveTab("daily")} style={{color: activeTab !== "daily" ? '#9ca3af' : '', borderColor: activeTab !== "daily" ? 'transparent' : ''}}>Daily Attendance View</div>
        <div className={`tab ${activeTab === "calendar" ? "active" : ""}`} onClick={() => setActiveTab("calendar")} style={{color: activeTab !== "calendar" ? '#9ca3af' : '', borderColor: activeTab !== "calendar" ? 'transparent' : ''}}>Calendar View</div>
      </div>

      {activeTab === "daily" && (
        <div className="daily-records">
          {daysList.map((day, idx) => {
            const isPresent = day.status === "Present" || day.status === "Full Day";
            const isHalf = day.status === "Half Day";
            const isAbsent = day.status === "Absent" || (!isPresent && !isHalf && day.status !== "Not Marked");

            let pCls = "status-tag";
            let pTxt = <span><b>P</b> | Present</span>;
            
            if (isPresent) {
               if (day.inStr && day.outStr) {
                  pCls = "status-tag active-p";
                  pTxt = <span><b>P</b> | {day.inStr} - {day.outStr}</span>;
               } else if (day.inStr && !day.outStr) {
                  pCls = "status-tag active-p-outline";
                  pTxt = <span><b>P</b> | {day.inStr} - NA</span>;
               } else {
                  pCls = "status-tag active-p";
               }
            }

            return (
              <div className="record-row" key={idx}>
                <div className="record-left">
                  <div className="record-date" style={{color: day.status === "Not Marked" ? '#374151' : '#111827'}}>{day.formattedDate}</div>
                  {day.hrs ? (
                    <div className="record-sub" style={{color: '#374151'}}>
                      {day.hrs}<br/>
                      <span style={{color: '#9ca3af'}}><i className="ri-information-line"></i> 1 Shift(s)</span>
                    </div>
                  ) : (
                    <div className={`record-sub ${day.status === "Not Marked" ? "error" : ""}`}>{day.status}</div>
                  )}
                  <div className="record-actions">
                    <span style={{cursor: 'pointer'}}>Add Note</span> &nbsp;-&nbsp; 
                    <span style={{cursor: 'pointer'}} onClick={() => setShowLogs(day)}>Logs</span>
                  </div>
                </div>

                <div className="record-tags">
                   <div className="tag-row">
                      <div className={pCls}>{pTxt}</div>
                      <div className={`status-tag ${isHalf ? 'active-p-outline' : ''}`} style={isHalf ? {borderColor: '#f59e0b', color: '#d97706'} : {}}>
                        <b style={{color: isHalf ? '#d97706' : '#374151'}}>HD</b> | Half Day
                      </div>
                      <div className={`status-tag ${isAbsent ? 'active-p-outline' : ''}`} style={isAbsent ? {borderColor: '#ef4444', color: '#ef4444'} : {}}>
                         <b style={{color: isAbsent ? '#ef4444' : '#374151'}}>A</b> | Absent
                      </div>
                   </div>
                   <div className="tag-row">
                      <div className="status-tag"><b>F</b> | Fine</div>
                      <div className="status-tag"><b>OT</b> | Overtime</div>
                      <div className="status-tag"><b>L</b> | Leave</div>
                   </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="calendar-view">
          <div className="calendar-grid">
            {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(day => (
              <div key={day} className="calendar-header-cell">{day}</div>
            ))}
            
            {calendarCells.map(cell => (
              <div key={cell.key} className={`calendar-cell ${cell.empty ? 'empty' : ''}`}>
                {!cell.empty && (
                  <>
                    <div className={`calendar-date ${cell.isToday ? 'today' : ''}`}>{cell.date}</div>
                    <div className="calendar-status" style={{marginTop: 'auto'}}>
                      {cell.shortName ? (
                        <>
                          <div className={`status-circle ${cell.statusClass}`}>{cell.shortName}</div>
                          {cell.status}
                        </>
                      ) : (
                        <span style={{color: '#9ca3af', fontSize: '11px'}}>Not Marked</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="legend-row">
            <div className="legend-item"><div className="status-circle p">P</div> Present</div>
            <div className="legend-item"><div className="status-circle p" style={{background: '#16a34a'}}>OD</div> On Duty</div>
            <div className="legend-item"><div className="status-circle a">A</div> Absent</div>
            <div className="legend-item"><div className="status-circle a" style={{background: '#ef4444'}}>F</div> Fine</div>
            <div className="legend-item"><div className="status-circle p" style={{background: '#16a34a'}}>OT</div> Overtime</div>
            <div className="legend-item"><div className="status-circle hd">HD</div> Half Day</div>
            <div className="legend-item"><div className="status-circle wo">WO</div> Weekly Off</div>
            <div className="legend-item"><div className="status-circle p" style={{background: '#16a34a'}}>PCO</div> Present</div>
            <div className="legend-item"><div className="status-circle hd" style={{background: '#f59e0b'}}>HDCO</div> Half Day</div>
            <div className="legend-item"><div className="status-circle pl">PL</div> Paid Leave</div>
            <div className="legend-item"><div className="status-circle pl" style={{background: '#8b5cf6'}}>H</div> Holiday</div>
            <div className="legend-item"><div className="status-circle l">L</div> Leave</div>
            <div className="legend-item"><span style={{color: '#9ca3af', textDecoration: 'underline'}}>Not Marked</span></div>
          </div>
        </div>
      )}

      {renderMapLog()}
    </div>
  );
}
