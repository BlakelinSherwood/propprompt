import { MapPin, Layers, Grid3X3, Shield } from "lucide-react";

const TYPES = [
  {
    key: "single",
    icon: MapPin,
    title: "Single Territory",
    description: "Claim one town or city — one seat.",
    color: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
    iconColor: "bg-emerald-100 text-emerald-700",
    priceLabel: (p) => `From $${parseFloat(p?.starter_monthly_price || 0).toFixed(0)}/mo`,
  },
  {
    key: "pool",
    icon: Layers,
    title: "Population Pool",
    description: (p) => `Cover multiple small towns. Pay per ${parseInt(p?.territory_seat_size || 50000).toLocaleString()} residents — not per town.`,
    color: "border-blue-200 bg-blue-50 hover:border-blue-400",
    iconColor: "bg-blue-100 text-blue-700",
    priceLabel: (p) => `From $${parseFloat(p?.starter_monthly_price || 0).toFixed(0)}/mo per ${parseInt(p?.territory_seat_size || 50000).toLocaleString()} residents`,
  },
  {
    key: "bundle",
    icon: Grid3X3,
    title: "Town Bundle",
    description: (p) => `Claim multiple territories at a bundle discount. Up to ${parseFloat(p?.bundle_master_discount || 0).toFixed(0)}% off.`,
    color: "border-purple-200 bg-purple-50 hover:border-purple-400",
    iconColor: "bg-purple-100 text-purple-700",
    priceLabel: (p) => `Up to ${parseFloat(p?.bundle_master_discount || 0).toFixed(0)}% bundle discount`,
  },
  {
    key: "buyout",
    icon: Shield,
    title: "Full City Buyout",
    description: (p) => `Own every seat in a multi-seat city. Complete exclusivity, up to ${parseFloat(p?.buyout_10plus_seat_discount || 0).toFixed(0)}% off.`,
    color: "border-amber-200 bg-amber-50 hover:border-amber-400",
    iconColor: "bg-amber-100 text-amber-700",
    priceLabel: (p) => `Up to ${parseFloat(p?.buyout_10plus_seat_discount || 0).toFixed(0)}% buyout discount`,
  },
];

export default function ClaimTypeSelector({ pricing, onSelect }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#1A3226]">Claim a Territory</h1>
        <p className="text-sm text-[#1A3226]/60 mt-2">Choose how you want to establish your exclusive PropPrompt presence.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TYPES.map(t => {
          const Icon = t.icon;
          const desc = typeof t.description === "function" ? t.description(pricing) : t.description;
          const price = t.priceLabel(pricing);
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              className={`rounded-2xl border-2 p-6 text-left transition-all hover:shadow-md ${t.color}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${t.iconColor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-[#1A3226] text-base mb-1">{t.title}</h3>
              <p className="text-sm text-[#1A3226]/60 mb-3 leading-relaxed">{desc}</p>
              <p className="text-xs font-medium text-[#1A3226]/70 bg-white/60 rounded-full px-3 py-1 inline-block">{price}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}