import { Building2, Unlock, DollarSign, MapPin } from "lucide-react";

export default function SubStatsRow({ territories, ledgerTotal }) {
  const sublicensed = territories.filter(t => t.status === 'sublicensed').length;
  const available = territories.filter(t => t.status === 'reserved').length;

  const stats = [
    { icon: MapPin, label: "Total Towns", value: "351", color: "text-[#1A3226]" },
    { icon: Building2, label: "Sublicensed", value: sublicensed, color: "text-purple-600" },
    { icon: Unlock, label: "Available to Sublicense", value: available, color: "text-slate-600" },
    { icon: DollarSign, label: "Rev Share This Month", value: `$${ledgerTotal.toFixed(2)}`, color: "text-green-600" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-[#1A3226]/10 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center">
            <s.icon className={`w-4 h-4 ${s.color}`} />
          </div>
          <div>
            <p className="text-xs text-[#1A3226]/50">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}