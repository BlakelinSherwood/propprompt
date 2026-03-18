import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { base44 } from "@/api/base44Client";

export default function TerritoryLandingMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapFailed, setMapFailed] = useState(false);

  // Fetch territories
  useEffect(() => {
    const loadTerritories = async () => {
      try {
        const result = await base44.entities.Territory.list('', 5000);
        setTerritories(result || []);
      } catch (err) {
        console.warn("Territory data unavailable, showing map without markers:", err);
        setTerritories([]);
      } finally {
        setLoading(false);
      }
    };
    loadTerritories();
  }, []);

  // Initialize map and render markers
  useEffect(() => {
    if (loading || !mapContainer.current) return;
    if (map.current) return;

    const initMap = async () => {
      try {
        let token;
        try {
          const { data } = await base44.functions.invoke('getMapboxToken', {});
          token = data?.token;
        } catch (tokenError) {
          console.warn("Could not fetch Mapbox token from function", tokenError);
          setMapFailed(true);
          return;
        }

        if (!token) {
          setMapFailed(true);
          return;
        }
        mapboxgl.accessToken = token;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [-71.8, 43.0],
          zoom: 6.2,
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

          // Fit bounds to show all New England
          const bounds = new mapboxgl.LngLatBounds(
            [-73.8, 40.9],
            [-69.8, 47.5]
          );
          map.current.fitBounds(bounds, { padding: 40 });
        });
      } catch (err) {
        console.error("Failed to initialize map:", err);
        setMapFailed(true);
      }
    };

    initMap();

    return () => {
      if (map.current) map.current.remove();
      map.current = null;
    };
  }, [loading, territories]);

  return (
    <div className="space-y-4">
      <div
        ref={mapContainer}
        className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#1A3226] to-[#2D5A40] flex items-center justify-center"
        style={{ height: "420px", minHeight: "420px" }}
      >
        {loading && (
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-white/60">Loading territories...</p>
          </div>
        )}
        {mapFailed && !loading && (
          <div className="text-center">
            <p className="text-sm text-white/70 mb-2">Map unavailable</p>
            <p className="text-xs text-white/50">Explore territories list below</p>
          </div>
        )}
      </div>
      <div className="text-center">
        <a
          href="/Territories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A3226] hover:text-[#B8982F] transition-colors"
        >
          Explore available territories →
        </a>
      </div>
    </div>
  );
}