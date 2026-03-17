import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const STATUS_COLORS = {
  sublicensed: "#7c3aed",
  available: "#22c55e",
  reserved: "#1e293b",
  default: "#94a3b8",
};

export default function TerritoryMapbox({ territories, onTownClick }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-71.3, 42.3],
      zoom: 9,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach(m => m.remove());
    markers.current = [];

    territories.forEach(t => {
      if (!t.lat || !t.lng) return;
      const color = STATUS_COLORS[t.status] || STATUS_COLORS.default;
      const el = document.createElement("div");
      el.style.cssText = `
        width: 12px; height: 12px; border-radius: 50%;
        background: ${color}; border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      el.title = t.city_town;
      el.addEventListener("click", () => onTownClick?.(t));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([t.lng, t.lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
          `<div style="font-size:13px;font-weight:600">${t.city_town}</div>
           <div style="font-size:11px;color:#64748b;text-transform:capitalize">${t.status}</div>`
        ))
        .addTo(map.current);

      markers.current.push(marker);
    });
  }, [territories]);

  return (
    <div className="rounded-xl overflow-hidden border border-[#1A3226]/10" style={{ height: 360 }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <div className="absolute bottom-3 left-3 flex gap-2 z-10 pointer-events-none">
        {[
          { color: "#1e293b", label: "Reserved" },
          { color: "#7c3aed", label: "Sublicensed" },
          { color: "#22c55e", label: "Released" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1 bg-white/90 rounded px-2 py-1 text-xs shadow">
            <span style={{ background: l.color }} className="w-2.5 h-2.5 rounded-full inline-block" />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}