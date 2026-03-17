import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { base44 } from "@/api/base44Client";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function TerritoryLandingMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch territories
  useEffect(() => {
    const loadTerritories = async () => {
      try {
        const result = await base44.entities.Territory.list();
        setTerritories(result || []);
      } catch (err) {
        console.error("Failed to load territories:", err);
      }
      setLoading(false);
    };
    loadTerritories();
  }, []);

  // Initialize map and render markers
  useEffect(() => {
    if (loading || !mapContainer.current) return;
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-71.5, 43.8],
      zoom: 6,
      pitch: 0,
      bearing: 0,
      scrollZoom: false,
      dragPan: false,
      attributionControl: false,
    });

    map.current.on("load", () => {
      // Add markers for each territory
      territories.forEach((territory) => {
        if (!territory.lat || !territory.lng) return;

        const statusColorMap = {
          available: "#22c55e",
          pending_approval: "#eab308",
          active: "#ef4444",
          reserved: "#ef4444",
          sublicensed: "#ef4444",
          coming_soon: "#94a3b8",
        };

        const markerSize =
          territory.seats_total >= 5
            ? 8
            : territory.seats_total >= 2
              ? 6
              : 4;

        const el = document.createElement("div");
        el.className = "territory-marker";
        el.style.width = `${markerSize * 2}px`;
        el.style.height = `${markerSize * 2}px`;
        el.style.borderRadius = "50%";
        el.style.backgroundColor =
          statusColorMap[territory.status] || "#94a3b8";
        el.style.border = "2px solid rgba(255, 255, 255, 0.3)";
        el.style.cursor = "pointer";
        el.style.transition = "all 0.2s ease";

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([territory.lng, territory.lat])
          .addTo(map.current);

        // Hover tooltip
        el.addEventListener("mouseenter", () => {
          new mapboxgl.Popup({ offset: 25 })
            .setLngLat([territory.lng, territory.lat])
            .setHTML(`<div class="text-sm font-medium">${territory.city_town}, ${territory.state_id}</div>`)
            .addTo(map.current);

          el.style.transform = "scale(1.3)";
          el.style.zIndex = "1000";
        });

        el.addEventListener("mouseleave", () => {
          map.current.getCanvas().style.cursor = "";
          el.style.transform = "scale(1)";
          el.style.zIndex = "0";
          document.querySelectorAll(".mapboxgl-popup").forEach((p) => p.remove());
        });
      });

      // Fit bounds to ME, NH, VT, MA
      const bounds = new mapboxgl.LngLatBounds(
        [-73.5, 41.2],
        [-66.8, 47.5]
      );
      map.current.fitBounds(bounds, { padding: 40 });
    });

    return () => {
      if (map.current) map.current.remove();
      map.current = null;
    };
  }, [loading, territories]);

  return (
    <div className="space-y-4">
      <div
        ref={mapContainer}
        className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#1A3226] to-[#2D5A40]"
        style={{ height: "420px", minHeight: "420px" }}
      />
      <div className="text-center">
        <a
          href="/territories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A3226] hover:text-[#B8982F] transition-colors"
        >
          Explore available territories →
        </a>
      </div>
    </div>
  );
}