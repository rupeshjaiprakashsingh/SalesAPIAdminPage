/* eslint-disable no-undef */
import { useEffect } from "react";

const AdvancedMarker = ({ map, position, label, onClick }) => {
  useEffect(() => {
    if (!map || !position) return;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title: label,
    });

    marker.addListener("click", () => {
      if (onClick) onClick();
    });

    return () => {
      marker.map = null;
    };
  }, [map, position]);

  return null;
};

export default AdvancedMarker;
