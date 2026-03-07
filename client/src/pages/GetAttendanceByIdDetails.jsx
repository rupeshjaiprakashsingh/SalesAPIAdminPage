import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "../styles/map.css";

import {
  GoogleMap,
  Marker,
  Polyline,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";

export default function GetAttendanceByIdDetails() {
  const { id } = useParams();
  const query = new URLSearchParams(window.location.search);
  const date = query.get("date");

  const [attendance, setAttendance] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const token =
    JSON.parse(localStorage.getItem("auth")) ||
    localStorage.getItem("token") ||
    "";

  // Load Google Maps
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "AIzaSyBAbFbmXPOSgsBnhuYrCtSQ7yXK_0nB--Y",
  });

  // ========= API CALL =========
  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(
          `/api/v1/attendance/day/${id}?date=${date}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setAttendance(res.data);
      } catch (err) {
        console.error("DETAILS API ERROR:", err);
      }
    }

    load();
  }, [id, date, token]);

  if (!attendance) return <div>Loading...</div>;
  if (!isLoaded) return <div>Loading Map...</div>;

  const IN = attendance.in;
  const OUT = attendance.out;

  let inPos = IN ? { lat: IN.latitude, lng: IN.longitude } : null;
  let outPos = OUT ? { lat: OUT.latitude, lng: OUT.longitude } : null;

  // Avoid marker overlap
  if (
    inPos &&
    outPos &&
    inPos.lat === outPos.lat &&
    inPos.lng === outPos.lng
  ) {
    outPos = {
      lat: outPos.lat + 0.0002,
      lng: outPos.lng + 0.0002,
    };
  }

  const pathPoints = [inPos, outPos].filter(Boolean);

  return (
    <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
      
      {/* LEFT PANEL */}
      <div
        style={{
          width: "360px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          background: "#fff",
        }}
      >
        <h2>{attendance.user?.name}</h2>
        <p style={{ marginTop: 0 }}>{attendance.user?.email}</p>

        <div><strong>Date:</strong> {attendance.date}</div>
        <div><strong>Total Hours:</strong> {attendance.totalHours}</div>

        <hr />

        <h3>In Details</h3>
        {IN ? (
          <ul>
            <li><strong>Time:</strong> {new Date(IN.deviceTime).toLocaleString()}</li>
            <li><strong>Address:</strong> {IN.address}</li>
            <li><strong>Battery:</strong> {IN.batteryPercentage}%</li>
            <li><strong>Network:</strong> {IN.networkType}</li>
            <li><strong>Validated:</strong> {IN.validatedInsideGeoFence ? "Yes" : "No"}</li>
          </ul>
        ) : (
          <p>No IN Records</p>
        )}

        <hr />

        <h3>Out Details</h3>
        {OUT ? (
          <ul>
            <li><strong>Time:</strong> {new Date(OUT.deviceTime).toLocaleString()}</li>
            <li><strong>Address:</strong> {OUT.address}</li>
            <li><strong>Battery:</strong> {OUT.batteryPercentage}%</li>
            <li><strong>Network:</strong> {OUT.networkType}</li>
            <li><strong>Validated:</strong> {OUT.validatedInsideGeoFence ? "Yes" : "No"}</li>
          </ul>
        ) : (
          <p>No OUT Records</p>
        )}
      </div>

      {/* ===== GOOGLE MAP ===== */}
      <div className="map-wrapper">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={inPos || { lat: 20.5937, lng: 78.9629 }}
          zoom={15}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
          }}
        >

          {/* IN Marker */}
          {inPos && (
            <Marker
              position={inPos}
              label="IN"
              onClick={() => setSelectedMarker({ type: "IN", data: IN })}
            />
          )}

          {/* OUT Marker */}
          {outPos && (
            <Marker
              position={outPos}
              label="OUT"
              onClick={() => setSelectedMarker({ type: "OUT", data: OUT })}
            />
          )}

          {/* Polyline */}
          {pathPoints.length >= 2 && (
            <Polyline
              path={pathPoints}
              options={{
                strokeColor: "#0000FF",
                strokeWeight: 3,
              }}
            />
          )}

          {/* Info Popup */}
          {selectedMarker && (
            <InfoWindow
              position={
                selectedMarker.type === "IN" ? inPos : outPos
              }
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div>
                <b>{selectedMarker.type}</b><br />
                {selectedMarker.data.address}<br />
                {new Date(selectedMarker.data.deviceTime).toLocaleString()}
              </div>
            </InfoWindow>
          )}

        </GoogleMap>
      </div>
    </div>
  );
}
