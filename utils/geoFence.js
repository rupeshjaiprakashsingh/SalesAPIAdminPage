// Haversine Formula – distance between 2 lat/lng points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---- OFFICE LOCATION ----
// Set this as your office lat/lng like below:
const OFFICE_LAT = 28.6139;
const OFFICE_LNG = 77.2090;
const GEOFENCE_RADIUS = 200; // meter radius

function isInsideGeofence(userLat, userLng) {
  const distance = calculateDistance(userLat, userLng, OFFICE_LAT, OFFICE_LNG);
  return distance <= GEOFENCE_RADIUS;
}

module.exports = { isInsideGeofence, calculateDistance };
