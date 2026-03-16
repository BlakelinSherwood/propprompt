import { CheckCircle, Loader2 } from "lucide-react";

const SECTIONS = [
  { label: "System Context", threshold: 0 },
  { label: "Property Intake", threshold: 200 },
  { label: "Valuation Module", threshold: 600 },
  { label: "Market Analysis", threshold: 1200 },
  { label: "Strategy", threshold: 2000 },
  { label: "Finalizing", threshold: 3000 },
];

export default function StreamProgressBar({ status, outputLength }) {
  if (status === "loading") {
    return (
      <div className="rounded-xl border border-[#B8982F]/20 bg-[#B8982F]/5 px-5 py-3 mb-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-[#B8982F]" />
        <span className="text-sm text-[#1A3226]/70">Assembling prompt…</span>
      </div>
    );
  }

  if (status === "error" || status === "complete") return null;

  const activeIndex = SECTIONS.reduce((acc, s, i) => outputLength >= s.threshold ? i : acc, 0);

  return (
    <div className="rounded-xl border border-[#1A3226]/8 bg-[#1A3226]/[0.02] px-5 py-3 mb-4">
      <div className="flex items-center justify-between gap-2">
        {SECTIONS.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={s.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className={`w-2 h-2 rounded-full transition-all ${
                done ? "bg-[#B8982F]" : active ? "bg-[#1A3226] animate-pulse" : "bg-[#1A3226]/15"
              }`} />
              <span className={`text-[10px] text-center leading-tight hidden sm:block truncate w-full text-center ${
                done || active ? "text-[#1A3226]/70" : "text-[#1A3226]/30"
              }`}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}