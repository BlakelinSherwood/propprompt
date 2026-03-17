import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import TerritoryLegend from "./TerritoryLegend";
import TerritoryPopupContent from "./TerritoryPopupContent";
import { createRoot } from "react-dom/client";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function getColor(t) {
  if (t.status === "coming_soon") return "#94a3b8";
  if (t.status === "reserved") return "#1e293b";
  if (t.status === "pool_member") return "#6366f1";
  if (t.status === "available") return "#22c55e";
  if (t.status === "pending_approval") return "#eab308";
  if (t.status === "active") {
    const claimed = t.seats_claimed || 0;
    const total = t.seats_total || 1;
    if (claimed >= total) return "#ef4444";
    return "#f97316";
  }
  return "#94a3b8";
}

function getRadius(seats) {
  if (seats >= 5) return 12;
  if (seats >= 2) return 9;
  return 6;
}

export default function TerritoryMap({
  territories,
  stateMap,
  countyMap,
  pricing,
  selectedTerritory,
  onSelectTerritory,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-69.5, 44.5],
      zoom: 6,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    territories.forEach((t) => {
      if (!t.lat || !t.lng) return;

      const seats = t.seats_total || 1;
      const radius = getRadius(seats);
      const color = getColor(t);

      const el = document.createElement("div");
      el.style.cssText = `
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.15s;
      `;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.3)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

      el.addEventListener("click", () => {
        onSelectTerritory(t);

        if (popupRef.current) popupRef.current.remove();

        const container = document.createElement("div");
        const root = createRoot(container);
        root.render(
          <TerritoryPopupContent
            territory={t}
            state={stateMap[t.state_id]}
            county={countyMap[t.county_id]}
            pricing={pricing}
          />
        );

        popupRef.current = new mapboxgl.Popup({ offset: 15, maxWidth: "300px" })
          .setLngLat([t.lng, t.lat])
          .setDOMContent(container)
          .addTo(map.current);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([t.lng, t.lat])
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  }, [territories, pricing]);

  // Fly to selected territory
  useEffect(() => {
    if (!map.current || !selectedTerritory?.lat) return;
    map.current.flyTo({ center: [selectedTerritory.lng, selectedTerritory.lat], zoom: 10, duration: 800 });
  }, [selectedTerritory]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <TerritoryLegend />
    </div>
  );
}