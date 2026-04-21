import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon paths (Vite build issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeNumberedIcon(num, active) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${active ? "#1A3226" : "#9CA3AF"};
      color:white;font-size:11px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
      transition:background 0.2s;
    ">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function makeSubjectIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:#B8982F;color:white;font-size:14px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">★</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    }
  }, [positions.length]);
  return null;
}

async function geocode(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

function fmt(n) {
  if (!n) return "—";
  return "$" + Number(n).toLocaleString();
}

export default function CompsMap({ subjectAddress, comps, selected, onToggle }) {
  const [coords, setCoords] = useState({}); // address -> [lat, lng]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectAddress && comps.length === 0) return;
    const addresses = [subjectAddress, ...comps.map(c => c.address)].filter(Boolean);
    let cancelled = false;

    async function geocodeAll() {
      setLoading(true);
      const results = {};
      // Geocode in sequence to avoid rate limiting Nominatim
      for (const addr of addresses) {
        if (cancelled) break;
        if (results[addr]) continue;
        const latLng = await geocode(addr);
        if (latLng) results[addr] = latLng;
        await new Promise(r => setTimeout(r, 200)); // polite delay
      }
      if (!cancelled) {
        setCoords(results);
        setLoading(false);
      }
    }
    geocodeAll();
    return () => { cancelled = true; };
  }, [subjectAddress, comps.length]);

  const subjectCoord = coords[subjectAddress];
  const allPositions = Object.values(coords);

  if (loading && allPositions.length === 0) {
    return (
      <div className="rounded-xl border border-[#1A3226]/10 bg-[#FAF8F4] h-48 flex items-center justify-center text-xs text-[#1A3226]/40">
        Loading map…
      </div>
    );
  }

  const center = subjectCoord || allPositions[0] || [42.55, -70.88];

  return (
    <div className="rounded-xl overflow-hidden border border-[#1A3226]/10" style={{ height: 280 }}>
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        <FitBounds positions={allPositions} />

        {/* Subject property marker */}
        {subjectCoord && (
          <Marker position={subjectCoord} icon={makeSubjectIcon()}>
            <Popup>
              <div className="text-xs font-semibold">★ Subject Property</div>
              <div className="text-xs text-gray-600">{subjectAddress}</div>
            </Popup>
          </Marker>
        )}

        {/* Comp markers */}
        {comps.map((comp, idx) => {
          const pos = coords[comp.address];
          if (!pos) return null;
          const isSelected = selected.has(comp.address);
          return (
            <Marker
              key={comp.address + idx}
              position={pos}
              icon={makeNumberedIcon(idx + 1, isSelected)}
              eventHandlers={{ click: () => onToggle(comp.address) }}
            >
              <Popup>
                <div className="text-xs space-y-0.5 min-w-[160px]">
                  <div className="font-semibold text-[#1A3226]">#{idx + 1} · {comp.address}</div>
                  <div>{fmt(comp.sale_price)} · {comp.sale_date?.slice(0, 7) || "—"}</div>
                  <div className="text-gray-500">{comp.bedrooms || "—"}bd / {comp.bathrooms || "—"}ba · {comp.sqft?.toLocaleString() || "—"} sf</div>
                  <button
                    onClick={() => onToggle(comp.address)}
                    className={`mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${isSelected ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                  >
                    {isSelected ? "Remove from analysis" : "Add to analysis"}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}