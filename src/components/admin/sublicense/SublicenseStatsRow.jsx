import { MapPin, Share2, CheckCircle, DollarSign } from 'lucide-react';

export default function SublicenseStatsRow({ territories, ledger }) {
  const total = 351;
  const sublicensed = territories.filter(t => t.status === 'sublicensed').length;
  const available = territories.filter(t => t.status === 'reserved').length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = ledger
    .filter(l => new Date(l.period_start) >= monthStart)
    .reduce((sum, l) => sum + (l.share_amount || 0), 0);

  const stats = [
    { icon: MapPin, label: 'Total Towns', value: total.toLocaleString(), color: 'text-[#1A3226]' },
    { icon: Share2, label: 'Sublicensed', value: sublicensed, color: 'text-violet-600' },
    { icon: CheckCircle, label: 'Available to Sublicense', value: available, color: 'text-emerald-600' },
    { icon: DollarSign, label: 'Revenue Share This Month', value: `$${monthRevenue.toFixed(2)}`, color: 'text-[#B8982F]' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-[#1A3226]/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <s.icon className={`w-4 h-4 ${s.color}`} />
            <span className="text-xs text-[#1A3226]/50 font-medium">{s.label}</span>
          </div>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}