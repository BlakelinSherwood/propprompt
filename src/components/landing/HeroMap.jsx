import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { base44 } from "@/api/base44Client";

export default function HeroMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    const initMap = async () => {
      try {
        const { data } = await base44.functions.invoke('getMapboxToken', {});
        if (!data?.token) {
          console.warn("Mapbox token not available");
          return;
        }
        mapboxgl.accessToken = data.token;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [-71.5, 44],
          zoom: 6.5,
          pitch: 0,
          bearing: 0,
          attributionControl: false,
        });

        map.current.on("load", () => {
      // Add state boundaries as a filled layer with actual GeoJSON data
      map.current.addSource("states", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "Maine", status: "active" },
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [-71.0, 46.8], [-71.1, 46.5], [-70.8, 46.2], [-70.5, 45.8],
                  [-70.2, 45.5], [-70.0, 45.0], [-69.8, 44.8], [-69.5, 44.6],
                  [-69.3, 44.2], [-69.5, 43.9], [-69.8, 43.8], [-70.0, 43.5],
                  [-70.3, 43.6], [-70.5, 43.4], [-70.8, 43.5], [-71.0, 43.8],
                  [-71.2, 44.0], [-71.3, 44.5], [-71.2, 45.0], [-71.0, 45.5],
                  [-71.0, 46.0], [-71.0, 46.5], [-71.0, 46.8]
                ]]
              }
            },
            {
              type: "Feature",
              properties: { name: "New Hampshire", status: "claimed" },
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [-72.6, 45.3], [-71.5, 45.4], [-71.0, 45.0], [-70.8, 44.6],
                  [-70.7, 44.0], [-70.8, 43.5], [-71.0, 43.2], [-71.2, 43.3],
                  [-71.5, 43.5], [-72.0, 43.8], [-72.4, 44.2], [-72.6, 44.8],
                  [-72.7, 45.0], [-72.6, 45.3]
                ]]
              }
            },
            {
              type: "Feature",
              properties: { name: "Vermont", status: "available" },
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [-73.4, 45.4], [-72.4, 45.3], [-71.5, 45.4], [-71.2, 45.0],
                  [-71.3, 44.5], [-71.4, 44.0], [-71.5, 43.5], [-72.0, 43.8],
                  [-72.4, 44.2], [-72.8, 44.5], [-73.2, 45.0], [-73.4, 45.4]
                ]]
              }
            },
            {
              type: "Feature",
              properties: { name: "Massachusetts", status: "pending" },
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [-71.5, 43.5], [-70.8, 43.5], [-70.3, 42.7], [-70.5, 42.3],
                  [-71.0, 42.0], [-71.5, 42.2], [-72.0, 42.5], [-72.2, 43.0],
                  [-72.0, 43.5], [-71.5, 43.5]
                ]]
              }
            }
          ]
        }
      });

      map.current.addLayer({
        id: "state-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": [
            "match",
            ["get", "status"],
            "active", "#ef4444",
            "claimed", "#ef4444",
            "available", "#22c55e",
            "pending", "#f59e0b",
            "#94a3b8"
          ],
          "fill-opacity": 0.3
        }
      });

          map.current.addLayer({
            id: "state-border",
            type: "line",
            source: "states",
            paint: {
              "line-color": [
                "match",
                ["get", "status"],
                "active", "#ef4444",
                "claimed", "#ef4444",
                "available", "#22c55e",
                "pending", "#f59e0b",
                "#94a3b8"
              ],
              "line-width": 2,
              "line-opacity": 0.6
            }
          });
        });
      } catch (err) {
        console.error("Failed to initialize map:", err);
      }
    };

    initMap();
  }, []);

  return (
    <div className="relative w-full h-full opacity-40 select-none pointer-events-none">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}