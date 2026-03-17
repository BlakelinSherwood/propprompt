const TIERS = [
  { key: 'starter', label: 'Starter', priceKey: 'starter_monthly_price', capKey: 'starter_analyses_cap', color: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', features: ['Core AI analysis tools', 'PDF exports', 'Email reports'] },
  { key: 'pro', label: 'Pro', priceKey: 'pro_monthly_price', capKey: 'pro_analyses_cap', color: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', features: ['Everything in Starter', 'PPTX exports', 'Google Drive sync', 'CRM push'] },
  { key: 'team', label: 'Team', priceKey: 'team_monthly_price', capKey: 'team_analyses_cap', color: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', features: ['Everything in Pro', 'Team seat management', 'White-label branding', 'Priority support'] },
];

export default function TierSelector({ pricing, selectedTier, onChange, buckets = 1, showBucketCalc = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {TIERS.map(t => {
        const price = parseFloat(pricing[t.priceKey] || 0);
        const cap = parseInt(pricing[t.capKey] || 0);
        const totalPrice = price * buckets;
        const totalCap = cap * buckets;
        const selected = selectedTier === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`text-left p-5 rounded-xl border-2 transition-all ${selected ? `${t.color} shadow-md` : 'border-gray-200 hover:border-gray-300'} ${selected ? 'bg-white' : 'bg-white'}`}
          >
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>{t.label}</span>
            <div className="mt-3 text-2xl font-bold text-[#1A3226]">
              ${showBucketCalc ? totalPrice.toFixed(0) : price.toFixed(0)}
              <span className="text-sm font-normal text-gray-400">/mo</span>
            </div>
            {showBucketCalc && buckets > 1 && (
              <div className="text-xs text-gray-400 mt-0.5">{buckets} buckets × ${price}/mo</div>
            )}
            <div className="text-sm text-[#1A3226]/60 mt-1">
              {showBucketCalc ? totalCap : cap} analyses/mo
            </div>
            <ul className="mt-3 space-y-1">
              {t.features.map(f => (
                <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-emerald-500">✓</span> {f}
                </li>
              ))}
            </ul>
            {selected && <div className="mt-3 text-xs font-semibold text-[#1A3226]">✓ Selected</div>}
          </button>
        );
      })}
    </div>
  );
}