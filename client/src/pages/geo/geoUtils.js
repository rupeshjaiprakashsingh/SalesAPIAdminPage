// ─── Shared constants ──────────────────────────────────────────────────────
export const containerStyle = { width: "100%", height: "100%", borderRadius: "10px" };
export const defaultPosition = { lat: 19.182, lng: 72.969 };

// ─── Auth helper ───────────────────────────────────────────────────────────
export const getToken = () => {
    const authItem = localStorage.getItem("auth");
    if (!authItem) return null;
    try {
        return authItem.startsWith("{") ? JSON.parse(authItem).token : JSON.parse(authItem);
    } catch {
        return null;
    }
};

// ─── Map helpers ───────────────────────────────────────────────────────────
export function latLngToPixel(map, lat, lng) {
    const projection = map.getProjection();
    if (!projection) return null;
    const bounds = map.getBounds();
    if (!bounds) return null;
    const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
    const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
    const scale = Math.pow(2, map.getZoom());
    const point = projection.fromLatLngToPoint(new window.google.maps.LatLng(lat, lng));
    return {
        x: (point.x - bottomLeft.x) * scale,
        y: (point.y - topRight.y) * scale,
    };
}

// ─── Battery helpers ───────────────────────────────────────────────────────
export const getBatteryColor = (battery) => {
    if (battery == null) return "#6b7280";
    if (battery > 60) return "#16a34a";
    if (battery > 20) return "#d97706";
    return "#dc2626";
};

export const getBatteryIcon = (battery) => {
    if (battery == null) return "🔋";
    if (battery > 60) return "🔋";
    if (battery > 20) return "🪫";
    return "⚠️";
};

// ─── Distance helper ───────────────────────────────────────────────────────
export const calcDistMeters = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Path smoothing ────────────────────────────────────────────────────────
export const getSmoothedPath = (route) => {
    if (!route || route.length === 0) return [];
    const validRoute = route.filter(p =>
        p.lat != null && p.lng != null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng))
    );
    if (validRoute.length === 0) return [];

    const smoothed = [{ lat: Number(validRoute[0].lat), lng: Number(validRoute[0].lng), time: validRoute[0].time }];
    for (let i = 1; i < validRoute.length; i++) {
        const pt = validRoute[i];
        const last = smoothed[smoothed.length - 1];
        const lat = Number(pt.lat), lng = Number(pt.lng);
        const dist = calcDistMeters(last.lat, last.lng, lat, lng);

        if (pt.time && last.time) {
            const elapsedSec = (new Date(pt.time) - new Date(last.time)) / 1000;
            if (elapsedSec > 0 && dist / elapsedSec > 42) continue; // ~150 km/h max
        }

        if (dist > 25) {
            smoothed.push({ lat, lng, time: pt.time });
        }
    }
    const lastPt = validRoute[validRoute.length - 1];
    const lastSmoothed = smoothed[smoothed.length - 1];
    if (lastSmoothed.lat !== Number(lastPt.lat) || lastSmoothed.lng !== Number(lastPt.lng)) {
        smoothed.push({ lat: Number(lastPt.lat), lng: Number(lastPt.lng), time: lastPt.time });
    }
    return smoothed;
};

// ─── Time formatters ───────────────────────────────────────────────────────
export const formatTimeStr = (mins) => {
    if (!mins || isNaN(mins)) return "0 hrs 0 mins";
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h} hrs ${m} mins`;
};
