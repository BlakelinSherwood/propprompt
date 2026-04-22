import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { base44 } from "@/api/base44Client";
import { Loader2, Layers } from "lucide-react";

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

// Geocode a single address via Mapbox
async function geocode(address, token) {
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
  const [ready, setReady] = useState(false); // map initialized
  const [loading, setLoading] = useState(true);
  const [neighborhoodData, setNeighborhoodData] = useState(null);
  const [loadingNeighborhood, setLoadingNeighborhood] = useState(false);
  const [compsWithCoords, setCompsWithCoords] = useState([]);
  const [subjectCoords, setSubjectCoords] = useState(null);

  // Step 1: resolve coordinates — use lat/lng already on comps if available, fallback to geocoding
  useEffect(() => {
    if (!subjectAddress) return;
    let cancelled = false;

    async function resolveCoords() {
      setLoading(true);

      // Get token from backend
      let token = null;
      try {
        const res = await base44.functions.invoke("getMapboxToken", {});
        token = res.data?.token;
      } catch (e) {
        console.error("[CompsMapWithHeat] token fetch failed:", e);
      }
      if (!token || cancelled) { setLoading(false); return; }

      mapboxgl.accessToken = token;

      // Try to extract subject coords from comps (RentCast returns subjectProperty lat/lng)
      // Otherwise geocode the subject address
      let subjCoords = null;
      const firstCompWithCoords = comps?.find(c => c.latitude && c.longitude);
      if (firstCompWithCoords) {
        // Use a nearby comp's coords as rough center, then geocode subject
      }
      subjCoords = await geocode(subjectAddress, token);

      if (cancelled) return;
      setSubjectCoords(subjCoords);

      // For comps: use existing lat/lng if available (RentCast provides them), otherwise geocode
      const resolved = await Promise.all(
        (comps || []).map(async c => {
          if (c.latitude && c.longitude) {
            return { ...c, coords: { lat: c.latitude, lng: c.longitude } };
          }
          if (!c.address) return { ...c, coords: null };
          const coords = await geocode(c.address, token);
          return { ...c, coords };
        })
      );

      if (cancelled) return;
      setCompsWithCoords(resolved);
      setLoading(false);
    }

    resolveCoords();
    return () => { cancelled = true; };
  }, [subjectAddress, comps?.length]);

  // Step 2: Initialize map once we have subject coords
  useEffect(() => {
    if (!subjectCoords || mapRef.current) return;

    // Small delay to ensure container has real dimensions in DOM
    const t = setTimeout(() => {
      if (!containerRef.current) return;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [subjectCoords.lng, subjectCoords.lat],
        zoom: 13,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        map.resize();
        setReady(true);
      });

      const ro = new ResizeObserver(() => map.resize());
      ro.observe(containerRef.current);

      mapRef.current = map;
      mapRef.current._ro = ro;
    }, 100);

    return () => {
      clearTimeout(t);
      if (mapRef.current) {
        mapRef.current._ro?.disconnect();
        mapRef.current.remove();
        mapRef.current = null;
        setReady(false);
      }
    };
  }, [subjectCoords]);

  // Step 3: Add/update markers once map is ready
  useEffect(() => {
    if (!ready || !mapRef.current || !subjectCoords) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Subject marker
    const subjectEl = document.createElement("div");
    subjectEl.style.cssText = `width:16px;height:16px;background:#1A3226;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
    markersRef.current.push(
      new mapboxgl.Marker(subjectEl)
        .setLngLat([subjectCoords.lng, subjectCoords.lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(`<strong style="font-size:11px">Subject Property</strong><div style="font-size:10px;color:#666">${subjectAddress}</div>`))
        .addTo(mapRef.current)
    );

    const visibleComps = compsWithCoords.filter(c => c.coords);
    const ppsfValues = visibleComps.map(c => c.price_per_sqft).filter(Boolean);
    const minPpsf = ppsfValues.length ? Math.min(...ppsfValues) : 0;
    const maxPpsf = ppsfValues.length ? Math.max(...ppsfValues) : 1;

    visibleComps.forEach((comp, i) => {
      const isSelected = selected.has(comp.address);
      const ppsf = comp.price_per_sqft;
      const color = showHeat && ppsf ? ppsfToColor(ppsf, minPpsf, maxPpsf) : (isSelected ? "#B8982F" : "#94a3b8");

      const el = document.createElement("div");
      el.style.cssText = `width:22px;height:22px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);`;
      el.textContent = i + 1;
      el.onclick = () => onToggle(comp.address);

      const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(`
        <div style="font-size:11px;font-weight:600;margin-bottom:4px">${comp.address}</div>
        <div style="font-size:10px;color:#555">
          <div>Sale: $${Number(comp.sale_price || 0).toLocaleString()}</div>
          ${ppsf ? `<div>$/SF: <strong style="color:#1A3226">$${ppsf}</strong></div>` : ""}
          ${comp.sale_date ? `<div>Date: ${comp.sale_date.slice(0, 7)}</div>` : ""}
          <div style="margin-top:4px;border-top:1px solid #eee;padding-top:4px">
            ${isSelected ? '<span style="color:#16a34a">✓ Included</span>' : '<span style="color:#94a3b8">Excluded</span>'}
          </div>
        </div>
      `);

      markersRef.current.push(
        new mapboxgl.Marker(el)
          .setLngLat([comp.coords.lng, comp.coords.lat])
          .setPopup(popup)
          .addTo(mapRef.current)
      );
    });
  }, [ready, compsWithCoords, selected, showHeat, subjectCoords]);

  async function loadNeighborhoodData() {
    if (neighborhoodData || loadingNeighborhood) return;
    setLoadingNeighborhood(true);
    try {
      const town = subjectAddress?.split(",")[1]?.trim() || subjectAddress;
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `For ${town}, Massachusetts real estate market: What are the premium micro-neighborhoods vs. average/below-average micro-neighborhoods?
List 5-8 specific neighborhoods, streets, or areas with their typical PPSF premium or discount vs. town median.
Return ONLY JSON: {"town": "...", "median_ppsf": 625, "neighborhoods": [{"name": "...", "premium_pct": 18, "tier": "premium", "reason": "..."}]}`,
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
      console.warn("[CompsMapWithHeat] neighborhood fetch failed:", e.message);
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

  const ppsfValues = compsWithCoords.filter(c => c.coords && c.price_per_sqft).map(c => c.price_per_sqft);
  const minPpsf = ppsfValues.length ? Math.min(...ppsfValues) : 0;
  const maxPpsf = ppsfValues.length ? Math.max(...ppsfValues) : 1;

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border border-[#1A3226]/10" style={{ height: 320 }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

        {/* Controls */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
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
          <div className="absolute bottom-3 left-3 z-10 bg-white/95 rounded-lg px-3 py-2 shadow text-xs">
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
            <p className="text-xs text-[#1A3226]/50">Researching micro-neighborhood premiums…</p>
          ) : (
            <p className="text-xs text-[#1A3226]/40">No neighborhood data loaded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}