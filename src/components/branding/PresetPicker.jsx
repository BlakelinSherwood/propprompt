import { useState } from "react";
import { X, Check } from "lucide-react";

const PRESETS = [
  // Your Brokerage — pinned first
  { name: "Sherwood & Company", primary: "#1A3226", accent: "#B8982F", category: "Your Brokerage" },

  // National Franchises
  { name: "Keller Williams", primary: "#B40101", accent: "#1C1C1C", category: "National" },
  { name: "RE/MAX", primary: "#DC1C2E", accent: "#003DA5", category: "National" },
  { name: "Coldwell Banker", primary: "#003399", accent: "#CC0000", category: "National" },
  { name: "Century 21", primary: "#0D0D0D", accent: "#EBB514", category: "National" },
  { name: "Berkshire Hathaway HomeServices", primary: "#003087", accent: "#8B7355", category: "National" },
  { name: "eXp Realty", primary: "#002366", accent: "#E85A00", category: "National" },
  { name: "ERA Real Estate", primary: "#273691", accent: "#E31937", category: "National" },
  { name: "Better Homes & Gardens", primary: "#3A7A22", accent: "#CC5500", category: "National" },
  { name: "Weichert Realtors", primary: "#C05010", accent: "#1A1A1A", category: "National" },
  { name: "HomeSmart", primary: "#C05000", accent: "#003366", category: "National" },
  { name: "Realty ONE Group", primary: "#1A1A1A", accent: "#CC5500", category: "National" },
  { name: "Howard Hanna", primary: "#003087", accent: "#CC0000", category: "National" },
  { name: "Long & Foster", primary: "#1B2A4A", accent: "#9A7010", category: "National" },
  { name: "Redfin", primary: "#A50000", accent: "#555555", category: "National" },
  { name: "NextHome", primary: "#1A2A4A", accent: "#CC5500", category: "National" },
  { name: "John L. Scott Real Estate", primary: "#003366", accent: "#CC0000", category: "National" },
  { name: "Fathom Realty", primary: "#003366", accent: "#B8860B", category: "National" },
  { name: "Real Broker", primary: "#002D62", accent: "#2E78C8", category: "National" },
  { name: "United Real Estate", primary: "#003087", accent: "#CC0000", category: "National" },
  { name: "EXIT Realty", primary: "#CC0000", accent: "#B8860B", category: "National" },

  // Luxury
  { name: "Compass", primary: "#000000", accent: "#555555", category: "Luxury" },
  { name: "Sotheby's International Realty", primary: "#002349", accent: "#A88820", category: "Luxury" },
  { name: "Engel & Völkers", primary: "#1A1A1A", accent: "#CC0011", category: "Luxury" },
  { name: "The Agency", primary: "#111111", accent: "#A88820", category: "Luxury" },
  { name: "Douglas Elliman", primary: "#1A1A1A", accent: "#9A7010", category: "Luxury" },
  { name: "Christie's International RE", primary: "#1A1A1A", accent: "#8B0000", category: "Luxury" },
  { name: "Brown Harris Stevens", primary: "#002349", accent: "#A88820", category: "Luxury" },
  { name: "Corcoran", primary: "#111111", accent: "#BB0000", category: "Luxury" },
  { name: "SERHANT.", primary: "#1A1A1A", accent: "#CC5500", category: "Luxury" },
  { name: "Nest Seekers International", primary: "#0A0A0A", accent: "#A88820", category: "Luxury" },
  { name: "Hilton & Hyland", primary: "#0A0A0A", accent: "#9A7010", category: "Luxury" },
  { name: "Coldwell Banker Global Luxury", primary: "#002349", accent: "#A88820", category: "Luxury" },
  { name: "BHHS Luxury Collection", primary: "#003087", accent: "#A88820", category: "Luxury" },
  { name: "RE/MAX Collection", primary: "#002349", accent: "#CC0011", category: "Luxury" },
  { name: "KW Luxury", primary: "#1A1A1A", accent: "#B40101", category: "Luxury" },

  // Regional
  { name: "Windermere Real Estate", primary: "#1E4B8E", accent: "#A88820", category: "Regional" },
  { name: "Baird & Warner", primary: "#003366", accent: "#A88820", category: "Regional" },
  { name: "William Raveis Real Estate", primary: "#002349", accent: "#CC0000", category: "Regional" },
  { name: "Houlihan Lawrence", primary: "#002349", accent: "#A88820", category: "Regional" },
  { name: "Ebby Halliday Realtors", primary: "#003087", accent: "#CC0000", category: "Regional" },
  { name: "Michael Saunders & Company", primary: "#003087", accent: "#A88820", category: "Regional" },
  { name: "Allen Tate Realtors", primary: "#003087", accent: "#CC0000", category: "Regional" },
  { name: "Kentwood Real Estate", primary: "#1A3C2B", accent: "#A88820", category: "Regional" },

  // Archetypes
  { name: "Forest Green & Gold", primary: "#1A3226", accent: "#B8982F", category: "Archetypes" },
  { name: "Navy & Gold", primary: "#1B2A4A", accent: "#B8860B", category: "Archetypes" },
  { name: "Charcoal & Gold", primary: "#2C2C2C", accent: "#B8960B", category: "Archetypes" },
  { name: "Black & Gold (Luxury)", primary: "#0A0A0A", accent: "#A88820", category: "Archetypes" },
  { name: "Warm Burgundy & Copper", primary: "#6B1F2A", accent: "#B07040", category: "Archetypes" },
  { name: "Slate & Copper", primary: "#1A3A4A", accent: "#A86328", category: "Archetypes" },
  { name: "Deep Teal & Gold", primary: "#0D3D3D", accent: "#A88820", category: "Archetypes" },
  { name: "Midnight & Champagne", primary: "#1A1A2C", accent: "#A89840", category: "Archetypes" },
  { name: "Espresso & Cognac", primary: "#2C1A0A", accent: "#9A5018", category: "Archetypes" },
  { name: "Ink & Gold", primary: "#0D0D1A", accent: "#A88820", category: "Archetypes" },
  { name: "Steel Blue & Amber", primary: "#1A3A5C", accent: "#B86820", category: "Archetypes" },
  { name: "Pine Green & Cognac", primary: "#1A4A2E", accent: "#8A4A18", category: "Archetypes" },
  { name: "Storm Gray & Copper", primary: "#2C3A42", accent: "#A06020", category: "Archetypes" },
  { name: "Coastal Blue & Sandy Gold", primary: "#1A4A6A", accent: "#9A7830", category: "Archetypes" },
  { name: "Deep Plum & Gold", primary: "#3D1A3A", accent: "#A88820", category: "Archetypes" },
];

const CATEGORIES = ["All", "Your Brokerage", "National", "Luxury", "Regional", "Archetypes"];

export default function PresetPicker({ selectedPreset, onSelect }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = PRESETS.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Search + category pills */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search presets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-[#1A3226]/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1A3226]/40 hover:text-[#1A3226]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                activeCategory === cat
                  ? "bg-[#1A3226] text-white border-[#1A3226]"
                  : "bg-white text-[#1A3226]/60 border-[#1A3226]/20 hover:border-[#1A3226]/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-72 overflow-y-auto pr-1">
        {filtered.map(preset => {
          const isSelected = selectedPreset === preset.name;
          return (
            <button
              key={preset.name}
              onClick={() => onSelect(preset)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? "shadow-md"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/30 bg-white"
              }`}
              style={isSelected ? { borderColor: preset.primary, backgroundColor: preset.primary + "08" } : {}}
            >
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: preset.primary }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="flex gap-1.5 mb-2">
                <div className="w-7 h-7 rounded-full border border-black/10" style={{ backgroundColor: preset.primary }} />
                <div className="w-7 h-7 rounded-full border border-black/10" style={{ backgroundColor: preset.accent }} />
              </div>
              <div className="text-[11px] font-semibold text-[#1A3226] leading-tight">{preset.name}</div>
              <div className="text-[10px] text-[#1A3226]/40 mt-0.5">{preset.category}</div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-6 text-center text-sm text-[#1A3226]/40">No presets match your search.</div>
        )}
      </div>
    </div>
  );
}