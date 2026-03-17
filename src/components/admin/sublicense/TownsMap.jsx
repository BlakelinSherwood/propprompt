import { useEffect, useRef } from 'react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const STATUS_COLORS = {
  reserved: '#1e293b',
  sublicensed: '#7c3aed',
  available: '#22c55e',
  released: '#22c55e',
};

export default function TownsMap({ territories }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (mapInstance.current) return;

    import('mapbox-gl').then(mapboxgl => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.default.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-71.3, 42.3],
        zoom: 9,
      });

      mapInstance.current = map;

      map.on('load', () => {
        const hasCoordsWithId = territories.filter(t => t.lat && t.lng);
        hasCoordsWithId.forEach(t => {
          const color = STATUS_COLORS[t.status] || STATUS_COLORS.available;
          const el = document.createElement('div');
          el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:pointer;`;
          const popup = new mapboxgl.default.Popup({ offset: 8, closeButton: false }).setHTML(
            `<div style="font-size:12px;font-weight:600;color:#1A3226">${t.city_town}</div><div style="font-size:11px;color:#666;text-transform:capitalize">${t.status}</div>`
          );
          new mapboxgl.default.Marker(el).setLngLat([t.lng, t.lat]).setPopup(popup).addTo(map);
        });
      });
    });

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, []);

  // Update markers when territories change (after initial load)
  useEffect(() => {
    if (!mapInstance.current || !territories?.length) return;
    const markersRef = { current: [] };
    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    // Add updated markers
    territories.forEach(t => {
      if (!t.lat || !t.lng) return;
      const color = STATUS_COLORS[t.status] || STATUS_COLORS.available;
      const el = document.createElement('div');
      el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:pointer;`;
      const marker = new (import('mapbox-gl')).default.Marker(el)
        .setLngLat([t.lng, t.lat])
        .addTo(mapInstance.current);
      markersRef.current.push(marker);
    });
  }, [territories]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-64 rounded-xl border border-[#1A3226]/10 bg-[#1A3226]/5 flex items-center justify-center">
        <div className="text-center text-[#1A3226]/40 text-sm">
          <p className="font-medium">Map requires VITE_MAPBOX_TOKEN</p>
          <p className="text-xs mt-1">Add to your environment variables to enable the territory map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={mapRef} className="h-64 rounded-xl overflow-hidden border border-[#1A3226]/10" />
      <div className="flex items-center gap-4 text-xs text-[#1A3226]/60">
        {[['#1e293b', 'Reserved'], ['#7c3aed', 'Sublicensed'], ['#22c55e', 'Available']].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}