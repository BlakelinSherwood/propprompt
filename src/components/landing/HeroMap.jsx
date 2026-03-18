import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { base44 } from "@/api/base44Client";

export default function HeroMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;



    initMap();
  }, []);

  return (
    <div className="relative w-full h-full opacity-40 select-none">
      <div ref={mapContainer} className="w-full h-full" style={{ pointerEvents: 'none' }} />
    </div>
  );
}