import { Search } from "lucide-react";

const STATE_OPTS = ["all", "ME", "NH", "VT"];
const STATUS_OPTS = [
  { value: "all", label: "All Statuses" },
  { value: "available", label: "Available" },
  { value: "partial", label: "Partially Claimed" },
  { value: "claimed", label: "Fully Claimed" },
  { value: "pool", label: "Pool" },
];
const SEAT_OPTS = [
  { value: "all", label: "All Types" },
  { value: "single", label: "Single-Seat Towns" },
  { value: "multi", label: "Multi-Seat Cities" },
];

export default function TerritoryFilterBar({ filters, setFilters, states }) {
  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <div className="bg-white border-b border-[#1A3226]/10 px-4 py-2.5 flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A3226]/40" />
        <input
          type="text"
          placeholder="Search towns…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="pl-8 pr-3 py-1.5 text-sm border border-[#1A3226]/15 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30 w-44"
        />
      </div>

      {/* State */}
      <div className="flex gap-1">
        {STATE_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => set("state", s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filters.state === s
                ? "bg-[#1A3226] text-white"
                : "bg-[#1A3226]/5 text-[#1A3226]/70 hover:bg-[#1A3226]/10"
            }`}
          >
            {s === "all" ? "All States" : s}
          </button>
        ))}
      </div>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className="text-sm border border-[#1A3226]/15 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
      >
        {STATUS_OPTS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Seat type */}
      <select
        value={filters.seatType}
        onChange={(e) => set("seatType", e.target.value)}
        className="text-sm border border-[#1A3226]/15 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
      >
        {SEAT_OPTS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Available only toggle */}
      <label className="flex items-center gap-2 cursor-pointer ml-auto">
        <div
          onClick={() => set("availableOnly", !filters.availableOnly)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            filters.availableOnly ? "bg-[#22c55e]" : "bg-[#1A3226]/20"
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              filters.availableOnly ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
        <span className="text-xs text-[#1A3226]/70 font-medium">Available only</span>
      </label>
    </div>
  );
}