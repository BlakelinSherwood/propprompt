const LEGEND = [
  { color: "#22c55e", label: "Available" },
  { color: "#eab308", label: "Pending Approval" },
  { color: "#f97316", label: "Partially Claimed" },
  { color: "#ef4444", label: "Fully Claimed / Buyout" },
  { color: "#6366f1", label: "Pool Member" },
  { color: "#1e293b", label: "Reserved" },
];

export default function TerritoryLegend() {
  return (
    <div className="absolute bottom-6 left-3 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-[#1A3226]/10 p-3 z-10">
      <p className="text-[10px] uppercase tracking-wider text-[#1A3226]/50 font-semibold mb-2">Territory Status</p>
      <div className="space-y-1.5">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ background: l.color }} />
            <span className="text-xs text-[#1A3226]/70">{l.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 pt-2 border-t border-[#1A3226]/8">
        <p className="text-[10px] text-[#1A3226]/40 uppercase tracking-wider mb-1">Circle Size</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#1A3226]/30 border border-white" />
            <span className="text-[10px] text-[#1A3226]/50">1 seat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-[#1A3226]/30 border border-white" />
            <span className="text-[10px] text-[#1A3226]/50">2–4</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#1A3226]/30 border border-white" />
            <span className="text-[10px] text-[#1A3226]/50">5+</span>
          </div>
        </div>
      </div>
    </div>
  );
}