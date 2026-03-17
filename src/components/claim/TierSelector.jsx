import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const TIERS = [
  {
    key: "starter",
    label: "Starter",
    priceKey: "starter_monthly_price",
    capKey: "starter_analyses_cap",
    features: ["Core AI analysis tools", "PDF & PPTX export", "Email delivery"],
    color: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    highlight: false,
  },
  {
    key: "pro",
    label: "Pro",
    priceKey: "pro_monthly_price",
    capKey: "pro_analyses_cap",
    features: ["Everything in Starter", "CRM push integration", "Google Drive sync", "White-label branding"],
    color: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    highlight: true,
  },
  {
    key: "team",
    label: "Team",
    priceKey: "team_monthly_price",
    capKey: "team_analyses_cap",
    features: ["Everything in Pro", "Team member seats", "Bundle discounts eligible", "Priority support"],
    color: "border-purple-200 bg-purple-50",
    badge: "bg-purple-100 text-purple-700",
    highlight: false,
  },
];

export default function TierSelector({ pricing, selected, onChange, onNext, onBack, priceOverride }) {
  // priceOverride: function(tier) => { base, discounted } for bundle/pool/buyout
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A3226]">Choose Your Tier</h2>
        <p className="text-sm text-[#1A3226]/60 mt-1">All prices from the platform configuration.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map(t => {
          const basePrice = parseFloat(pricing[t.priceKey] || 0);
          const cap = parseInt(pricing[t.capKey] || 0);
          const override = priceOverride ? priceOverride(t.key, basePrice) : null;
          const displayPrice = override ? override.discounted : basePrice;
          const isSelected = selected === t.key;

          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                isSelected ? "border-[#1A3226] shadow-md" : t.color
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#B8982F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Most Popular</span>
                </div>
              )}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="w-5 h-5 text-[#1A3226]" />
                </div>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>{t.label}</span>
              <div className="mt-3 text-2xl font-bold text-[#1A3226]">
                ${displayPrice.toFixed(2)}
                <span className="text-sm font-normal text-[#1A3226]/50">/mo</span>
              </div>
              {override && override.discounted < override.base && (
                <div className="text-xs text-[#1A3226]/40 line-through">${override.base.toFixed(2)}/mo</div>
              )}
              <div className="mt-1 text-xs text-[#1A3226]/50">{cap} analyses/mo</div>
              <ul className="mt-3 space-y-1">
                {t.features.map(f => (
                  <li key={f} className="text-xs text-[#1A3226]/70 flex items-start gap-1.5">
                    <span className="text-[#1A3226]/30 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button
          onClick={onNext}
          disabled={!selected}
          className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}