import { usePricing } from '@/components/pricing/usePricing';
import { MapPin, Users, Grid, Shield } from 'lucide-react';

const TYPES = [
  {
    key: 'single',
    icon: MapPin,
    title: 'Single Territory',
    description: 'Claim one town or city — one seat.',
    color: 'hover:border-emerald-300 hover:bg-emerald-50/50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    key: 'pool',
    icon: Users,
    title: 'Population Pool',
    description: 'Cover multiple small towns. Pay per residents — not per town.',
    color: 'hover:border-orange-300 hover:bg-orange-50/50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    key: 'bundle',
    icon: Grid,
    title: 'Town Bundle',
    description: 'Claim multiple territories at a bundle discount.',
    color: 'hover:border-indigo-300 hover:bg-indigo-50/50',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
  {
    key: 'buyout',
    icon: Shield,
    title: 'Full City Buyout',
    description: 'Own every seat in a multi-seat city. Complete exclusivity.',
    color: 'hover:border-[#B8982F]/50 hover:bg-[#B8982F]/5',
    iconBg: 'bg-[#B8982F]/10',
    iconColor: 'text-[#B8982F]',
  },
];

export default function ClaimTypeSelector({ onSelect }) {
  const { pricing, loading } = usePricing();

  const getSub = (key) => {
    if (loading) return '…';
    const sp = parseFloat(pricing.starter_monthly_price || 0);
    const bucketSize = parseInt(pricing.pool_bucket_size || 50000);
    const masterDiscount = pricing.bundle_master_discount;
    const buyoutDiscount = pricing.buyout_10plus_seat_discount;
    if (key === 'single') return `From $${sp.toFixed(0)}/mo`;
    if (key === 'pool') return `From $${sp.toFixed(0)}/mo per ${(bucketSize / 1000).toFixed(0)}k residents`;
    if (key === 'bundle') return `Up to ${masterDiscount}% off`;
    if (key === 'buyout') return `Up to ${buyoutDiscount}% off`;
    return '';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-[#1A3226]">Claim a Territory</h1>
        <p className="text-gray-500 mt-2">Choose the type of claim that fits your strategy.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.key)}
              className={`text-left p-6 rounded-2xl border-2 border-gray-200 bg-white transition-all cursor-pointer group ${t.color}`}
            >
              <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${t.iconColor}`} />
              </div>
              <h3 className="font-semibold text-[#1A3226] text-base">{t.title}</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.description}</p>
              <p className="text-sm font-medium text-[#1A3226]/60 mt-3">{getSub(t.key)}</p>
              <div className="mt-4 text-sm font-medium text-[#1A3226] group-hover:underline">Get started →</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}