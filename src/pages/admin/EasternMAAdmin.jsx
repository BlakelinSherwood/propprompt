import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { usePricing } from '@/components/pricing/usePricing';
import { RefreshCw, MapPin, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SublicenseStatsRow from '@/components/admin/sublicense/SublicenseStatsRow';
import TownsMap from '@/components/admin/sublicense/TownsMap';
import TownsTable from '@/components/admin/sublicense/TownsTable';
import RevShareTab from '@/components/admin/sublicense/RevShareTab';

const TABS = [
  { id: 'towns', label: 'Towns', icon: MapPin },
  { id: 'revenue', label: 'Revenue Share', icon: DollarSign },
];

export default function EasternMAAdmin() {
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();
  const [user, setUser] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [counties, setCounties] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('towns');

  const loadData = useCallback(async () => {
    const [terrs, counties, subs, ledgerRows] = await Promise.all([
      base44.entities.Territory.list('-updated_date', 500),
      base44.entities.County.list('name', 200),
      base44.entities.TerritorySubscription.filter({ status: 'active' }),
      base44.entities.RevenueShareLedger.list('-period_start', 500),
    ]);
    setTerritories(terrs);
    setCounties(counties);
    setSubscriptions(subs);
    setLedger(ledgerRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.me().then(me => {
      if (me?.role !== 'platform_owner') navigate('/Dashboard');
      else { setUser(me); loadData(); }
    });
  }, []);

  if (loading || pricingLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Eastern Massachusetts</h1>
          <p className="text-sm text-[#1A3226]/50 mt-0.5">Founder territory panel — sublicensing & revenue share</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <SublicenseStatsRow territories={territories} ledger={ledger} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1A3226]/10">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-[#1A3226] text-[#1A3226]' : 'border-transparent text-[#1A3226]/50 hover:text-[#1A3226]'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'towns' && (
        <div className="space-y-6">
          <TownsMap territories={territories} />
          <TownsTable
            territories={territories}
            counties={counties}
            subscriptions={subscriptions}
            pricing={pricing}
            founderUserId={user?.id}
            onRefresh={loadData}
          />
        </div>
      )}

      {tab === 'revenue' && (
        <RevShareTab ledger={ledger} territories={territories} />
      )}
    </div>
  );
}