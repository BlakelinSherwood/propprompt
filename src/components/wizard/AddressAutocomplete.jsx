import { useState, useRef, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AddressAutocomplete({ value, onChange, placeholder, className }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch Mapbox token once
  useEffect(() => {
    base44.functions.invoke("getMapboxToken", {}).then(res => {
      setToken(res.data?.token || null);
    }).catch(() => {});
  }, []);

  // Sync external value changes
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function search(q) {
    if (!token || q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&types=address&country=US&language=en&limit=6`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features || []);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    onChange({ address: q }); // pass partial text up so field isn't blank
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  }

  function handleSelect(feature) {
    const fullAddress = feature.place_name;
    setQuery(fullAddress);
    setOpen(false);
    setSuggestions([]);

    // Extract rich address components
    const context = feature.context || [];
    const getCtx = (id) => context.find(c => c.id.startsWith(id))?.text || null;
    const getCtxShort = (id) => context.find(c => c.id.startsWith(id))?.short_code || null;

    const [lng, lat] = feature.center || [];

    // Build structured result
    const result = {
      address: fullAddress,
      address_street: feature.address ? `${feature.address} ${feature.text}` : feature.text,
      address_city: getCtx("place"),
      address_state: getCtxShort("region")?.replace("US-", "") || getCtx("region"),
      address_zip: getCtx("postcode"),
      address_county: getCtx("district"),
      latitude: lat || null,
      longitude: lng || null,
    };

    onChange(result);
  }

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30 z-10 pointer-events-none" />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30 animate-spin z-10 pointer-events-none" />
      )}
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "123 Main St, Boston, MA 02101"}
        autoComplete="off"
        className={`w-full pl-10 pr-4 py-2 text-sm border border-[#1A3226]/15 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#B8982F]/40 ${className || ""}`}
      />

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#1A3226]/15 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(f); }}
              className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-[#FAF8F4] border-b border-[#1A3226]/5 last:border-b-0 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#B8982F] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A3226] truncate">
                  {f.address ? `${f.address} ${f.text}` : f.text}
                </p>
                <p className="text-xs text-[#1A3226]/45 truncate">
                  {f.place_name.split(",").slice(1).join(",").trim()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}