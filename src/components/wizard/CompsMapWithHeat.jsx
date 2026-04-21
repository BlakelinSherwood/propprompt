import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { base44 } from "@/api/base44Client";
import { Loader2, Layers, X } from "lucide-react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Color scale for PPSF heat (low=blue → mid=yellow → high=red)
function ppsfToColor(ppsf, min, max) {
  if (!ppsf || ppsf === 0) return "#94a3b8";
  const ratio = Math.min(1, Math.max(0, (ppsf - min) / (max - min)));
  if (ratio < 0.5) {
    const r = Math.round(ratio * 2 * 255);
    return `rgb(${r}, ${Math.round(80 + ratio * 100)}, 200)`;
  } else {
    const r2 = (ratio - 0.5) * 2;
    return `rgb(${Math.round(200 + r2 * 55)}, ${Math.round(180 - r2 * 120)}, ${Math.round(200 - r2 * 180)})`;
  }
}

async function geocodeAddress(address) {
  const token = MAPBOX_TOKEN || (await base44.functions.invoke("getMapboxToken", {}).then(r => r.data?.token).catch(() => null));
  if (!token) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  const [lng, lat] = data.features?.[0]?.center || [];
  return lat && lng ? { lat, lng } : null;
}

export default function CompsMapWithHeat({ subjectAddress, comps, selected, onToggle }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [showHeat, setShowHeat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [neighborhoodData, setNeighborhoodData] = useState(null);
  const [loadingNeighborhood, setLoadingNeighborhood] = useState(false);
  const [geocodedComps, setGeocodedComps] = useState([]);
  const [subjectCoords, setSubjectCoords] = useState(null);
  const [mapToken, setMapToken] = useState(null);

  // Geocode subject + comps — also resolves and stores the token
  useEffect(() => {
    if (!subjectAddress) return;
    let cancelled = false;

    async function geocodeAll() {
      setLoading(true);
      const token = MAPBOX_TOKEN || await base44.functions.invoke("getMapboxToken", {}).then(r => r.data?.token).catch(() => null);
      if (!token) { setLoading(false); return; }
      mapboxgl.accessToken = token;
      if (!cancelled) setMapToken(token);

      const subj = await geocodeAddress(subjectAddress);
      if (cancelled) return;
      setSubjectCoords(subj);

      const withCoords = await Promise.all(
        (comps || []).map(async c => {
          if (!c.address) return { ...c, coords: null };
          const coords = await geocodeAddress(c.address);
          return { ...c, coords };
        })
      );
      if (!cancelled) setGeocodedComps(withCoords);
      if (!cancelled) setLoading(false);
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [subjectAddress, comps?.length]);

  // Initialize map — only after token + coords + container are ready
  useEffect(() => {
    if (!subjectCoords || !containerRef.current || mapRef.current || !mapToken) return;

    // Defer one frame so the container is fully painted before Mapbox measures it
    const raf = requestAnimationFrame(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [subjectCoords.lng, subjectCoords.lat],
      zoom: 13,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // Force resize so Mapbox canvas fills the container correctly
    map.on('load', () => { map.resize(); });

    // Also resize whenever the container changes size (e.g. panel expand)
    const observer = new ResizeObserver(() => { map.resize(); });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    }); // end rAF

    return () => { cancelAnimationFrame(raf); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [subjectCoords, mapToken]);

  // Add/update markers
  useEffect(() => {
    if (!mapRef.current || !subjectCoords) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Subject marker
    const subjectEl = document.createElement("div");
    subjectEl.style.cssText = `width:16px;height:16px;background:#1A3226;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:default;`;
    markersRef.current.push(new mapboxgl.Marker(subjectEl).setLngLat([subjectCoords.lng, subjectCoords.lat]).setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(`<strong style="font-size:11px">Subject Property</strong><div style="font-size:10px;color:#666">${subjectAddress}</div>`)).addTo(mapRef.current));

    const selectedComps = geocodedComps.filter(c => c.coords);
    const ppsfValues = selectedComps.map(c => c.price_per_sqft).filter(Boolean);
    const minPpsf = Math.min(...ppsfValues);
    const maxPpsf = Math.max(...ppsfValues);

    selectedComps.forEach((comp, i) => {
      const isSelected = selected.has(comp.address);
      const ppsf = comp.price_per_sqft;
      const color = showHeat && ppsf ? ppsfToColor(ppsf, minPpsf, maxPpsf) : (isSelected ? "#B8982F" : "#94a3b8");

      const el = document.createElement("div");
      el.style.cssText = `width:22px;height:22px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);transition:all 0.2s;`;
      el.textContent = i + 1;
      el.onclick = () => onToggle(comp.address);

      const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(`
        <div style="font-size:11px;font-weight:600;margin-bottom:4px">${comp.address}</div>
        <div style="font-size:10px;color:#555">
          <div>Sale: $${Number(comp.sale_price || 0).toLocaleString()}</div>
          ${ppsf ? `<div>$/SF: <strong style="color:#1A3226">$${ppsf}</strong></div>` : ""}
          ${comp.sale_date ? `<div>Date: ${comp.sale_date.slice(0, 7)}</div>` : ""}
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid #eee">
            ${isSelected ? '<span style="color:#16a34a">✓ Included</span>' : '<span style="color:#94a3b8">Excluded</span>'}
          </div>
        </div>
      `);

      markersRef.current.push(new mapboxgl.Marker(el).setLngLat([comp.coords.lng, comp.coords.lat]).setPopup(popup).addTo(mapRef.current));
    });
  }, [geocodedComps, selected, showHeat, subjectCoords]);

  // Load neighborhood tier data from Perplexity
  async function loadNeighborhoodData() {
    if (neighborhoodData || loadingNeighborhood) return;
    setLoadingNeighborhood(true);
    try {
      const town = subjectAddress?.split(",")[1]?.trim() || subjectAddress;
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `For ${town}, Massachusetts real estate market: What are the premium micro-neighborhoods vs. average/below-average micro-neighborhoods?
List 5-8 specific neighborhoods, streets, or areas with their typical PPSF premium or discount vs. town median.
Examples: "South End of [Town] — 15% premium", "Near train station — 10% premium", "Route 9 corridor — 5% discount"
Focus on: proximity to MBTA, school districts within town, specific streets/areas known as desirable, commercial noise zones.
Return ONLY JSON:
{"town": "Needham", "median_ppsf": 625, "neighborhoods": [{"name": "Highland Avenue area", "premium_pct": 18, "tier": "premium", "reason": "Walk to commuter rail, top schools"}, ...]}`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            town: { type: "string" },
            median_ppsf: { type: "number" },
            neighborhoods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  premium_pct: { type: "number" },
                  tier: { type: "string" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });
      setNeighborhoodData(result);
    } catch (e) {
      console.warn("[CompsMapWithHeat] neighborhood data fetch failed:", e.message);
    } finally {
      setLoadingNeighborhood(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#1A3226]/10 bg-[#FAF8F4] h-48 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-[#1A3226]/40 animate-spin" />
        <span className="text-sm text-[#1A3226]/50">Loading map…</span>
      </div>
    );
  }

  if (!subjectCoords) return null;

  const ppsfValues = geocodedComps.filter(c => c.coords && c.price_per_sqft).map(c => c.price_per_sqft);
  const minPpsf = Math.min(...ppsfValues);
  const maxPpsf = Math.max(...ppsfValues);

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-[#1A3226]/10" style={{ height: 320 }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

        {/* Controls */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <button
            onClick={() => { setShowHeat(v => !v); if (!neighborhoodData) loadNeighborhoodData(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md transition-all ${showHeat ? "bg-[#1A3226] text-white" : "bg-white text-[#1A3226] border border-[#1A3226]/20"}`}
          >
            <Layers className="w-3.5 h-3.5" />
            {showHeat ? "PPSF Heat: ON" : "PPSF Heat"}
          </button>
        </div>

        {/* PPSF Legend */}
        {showHeat && ppsfValues.length > 1 && (
          <div className="absolute bottom-3 left-3 bg-white/95 rounded-lg px-3 py-2 shadow text-xs">
            <div className="font-medium text-[#1A3226] mb-1">$/SF Range</div>
            <div className="flex items-center gap-2">
              <div style={{ width: 60, height: 8, borderRadius: 4, background: "linear-gradient(to right, rgb(0,130,200), rgb(255,200,0), rgb(255,60,20))" }} />
              <span className="text-[#1A3226]/60">${minPpsf} – ${maxPpsf}</span>
            </div>
          </div>
        )}
      </div>

      {/* Neighborhood Intelligence Panel */}
      {showHeat && (
        <div className="rounded-xl border border-[#1A3226]/10 bg-[#FAF8F4] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#1A3226]">Micro-Neighborhood Intelligence</p>
            {loadingNeighborhood && <Loader2 className="w-3.5 h-3.5 text-[#1A3226]/40 animate-spin" />}
          </div>
          {neighborhoodData?.neighborhoods?.length > 0 ? (
            <div className="space-y-2">
              {neighborhoodData.neighborhoods.map((n, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 mt-0.5 w-2 h-2 rounded-full ${n.tier === "premium" ? "bg-emerald-500" : n.tier === "discount" ? "bg-red-400" : "bg-amber-400"}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-[#1A3226]">{n.name}</span>
                    <span className={`ml-2 text-xs font-semibold ${n.premium_pct > 0 ? "text-emerald-600" : n.premium_pct < 0 ? "text-red-500" : "text-[#1A3226]/50"}`}>
                      {n.premium_pct > 0 ? "+" : ""}{n.premium_pct}%
                    </span>
                    <p className="text-[10px] text-[#1A3226]/50 mt-0.5">{n.reason}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-[#1A3226]/35 pt-1 border-t border-[#1A3226]/8">
                Town median: ~${neighborhoodData.median_ppsf?.toLocaleString()}/SF · Sourced via Perplexity web research
              </p>
            </div>
          ) : loadingNeighborhood ? (
            <p className="text-xs text-[#1A3226]/50">Researching micro-neighborhood premiums for {subjectAddress?.split(",")[1]?.trim()}…</p>
          ) : (
            <p className="text-xs text-[#1A3226]/40">Enable PPSF Heat to load neighborhood intelligence.</p>
          )}
        </div>
      )}
    </div>
  );
}