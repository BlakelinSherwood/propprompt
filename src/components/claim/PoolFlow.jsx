import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePricing } from '@/components/pricing/usePricing';
import TierSelector from './TierSelector';
import BrokerageInfoStep from './BrokerageInfoStep';
import TeamMembersStep from './TeamMembersStep';
import PaymentStep from './PaymentStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, AlertTriangle } from 'lucide-react';

const STEPS = ['Build Pool', 'Tier', 'Brokerage', 'Team', 'Payment'];

export default function PoolFlow({ territoryId }) {
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();
  const [step, setStep] = useState(0);
  const [allTerritories, setAllTerritories] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [tier, setTier] = useState('starter');
  const [brokerageInfo, setBrokerageInfo] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [user, setUser] = useState(null);
  const [bucketWarning, setBucketWarning] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Territory.filter({ status: 'available' }).then(ts => {
      setAllTerritories(ts.filter(t => !t.pool_id));
    });
  }, []);

  useEffect(() => {
    if (territoryId && allTerritories.length) {
      const t = allTerritories.find(t => t.id === territoryId);
      if (t && !selected.find(s => s.id === t.id)) setSelected([t]);
    }
  }, [territoryId, allTerritories]);

  const bucketSize = parseInt(pricing.pool_bucket_size || 50000);
  const totalPop = selected.reduce((sum, t) => sum + (t.population || 0), 0);
  const buckets = Math.max(1, Math.ceil(totalPop / bucketSize));
  const price = parseFloat(pricing[`${tier}_monthly_price`] || 0);
  const cap = parseInt(pricing[`${tier}_analyses_cap`] || 0);
  const totalPrice = price * buckets;
  const totalCap = cap * buckets;
  const remaining = (buckets * bucketSize) - totalPop;

  const filtered = allTerritories.filter(t =>
    !selected.find(s => s.id === t.id) &&
    t.city_town?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  const addTerritory = (t) => {
    const newPop = totalPop + (t.population || 0);
    const newBuckets = Math.ceil(newPop / bucketSize);
    if (newBuckets > buckets && selected.length > 0) {
      setBucketWarning({ territory: t, newBuckets, newPop, newPrice: price * newBuckets });
    } else {
      setSelected(prev => [...prev, t]);
    }
    setSearch('');
  };

  const confirmAdd = () => {
    setSelected(prev => [...prev, bucketWarning.territory]);
    setBucketWarning(null);
  };

  const handlePayment = async (paymentMethodId, setupIntentId) => {
    const autoApproveAt = new Date(Date.now() + (parseInt(pricing.auto_approve_hours || 48)) * 3600000).toISOString();
    const pool = await base44.entities.PopulationPool.create({
      owner_user_id: user?.id,
      tier,
      total_population: totalPop,
      bucket_count: buckets,
      monthly_price: totalPrice,
      analyses_cap: totalCap,
      stripe_setup_intent_id: setupIntentId,
      stripe_payment_method_id: paymentMethodId,
    });
    await Promise.all(selected.map(t =>
      base44.entities.PopulationPoolMember.create({ pool_id: pool.id, territory_id: t.id, population_contribution: t.population || 0 })
    ));
    await Promise.all(selected.map(t =>
      base44.entities.Territory.update(t.id, { status: 'pending_approval' })
    ));
    await base44.entities.TerritoryClaimRequest.create({
      pool_id: pool.id,
      user_id: user?.id,
      brokerage_name: brokerageInfo.brokerage_name,
      brokerage_license: brokerageInfo.brokerage_license,
      agent_count: parseInt(brokerageInfo.agent_count),
      tier_requested: tier,
      type_requested: 'pool',
      pool_territory_ids: selected.map(t => t.id),
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: 'pending',
      auto_approve_at: autoApproveAt,
    });
    navigate('/claim/submitted', { state: { claimType: 'pool', territories: selected, tier, monthlyPrice: totalPrice, buckets } });
  };

  if (pricingLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[#1A3226] text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm hidden sm:block ${i === step ? 'font-medium text-[#1A3226]' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#1A3226]">Build Your Population Pool</h2>
              <p className="text-sm text-gray-500 mt-1">Add small towns. Pricing is per {bucketSize.toLocaleString()} residents, not per town.</p>
            </div>

            {/* Pool meter */}
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-[#1A3226]">{totalPop.toLocaleString()} residents</span>
                <span className="text-orange-700">Bucket {buckets} — {remaining.toLocaleString()} until next</span>
              </div>
              <div className="w-full h-2 bg-orange-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((totalPop % bucketSize) / bucketSize) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center pt-1">
                <div><div className="font-bold text-[#1A3226]">{buckets}</div><div className="text-gray-400">Buckets</div></div>
                <div><div className="font-bold text-[#1A3226]">${totalPrice.toFixed(0)}/mo</div><div className="text-gray-400">{buckets} × ${price}/mo</div></div>
                <div><div className="font-bold text-[#1A3226]">{totalCap}</div><div className="text-gray-400">Analyses/mo</div></div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Input placeholder="Search towns by name…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                  {filtered.map(t => (
                    <button key={t.id} type="button" onClick={() => addTerritory(t)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between text-sm">
                      <span>{t.city_town}</span>
                      <span className="text-gray-400 text-xs">{(t.population || 0).toLocaleString()} residents</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected towns */}
            <div className="space-y-2">
              {selected.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <div>
                    <span className="text-sm font-medium text-[#1A3226]">{t.city_town}</span>
                    <span className="text-xs text-gray-400 ml-2">{(t.population || 0).toLocaleString()} residents</span>
                  </div>
                  <button onClick={() => setSelected(prev => prev.filter(s => s.id !== t.id))} className="text-gray-300 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {selected.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Search and add towns to your pool above.</p>}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={selected.length === 0} className="bg-[#1A3226] text-white">Continue →</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1A3226]">Select Your Tier</h2>
              <p className="text-sm text-gray-500 mt-1">{buckets} bucket{buckets !== 1 ? 's' : ''} × selected tier price = your monthly total.</p>
            </div>
            <TierSelector pricing={pricing} selectedTier={tier} onChange={setTier} buckets={buckets} showBucketCalc />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>← Back</Button>
              <Button onClick={() => setStep(2)} className="bg-[#1A3226] text-white">Continue →</Button>
            </div>
          </div>
        )}

        {step === 2 && <BrokerageInfoStep data={brokerageInfo} onChange={setBrokerageInfo} tier={tier} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <TeamMembersStep members={teamMembers} onChange={setTeamMembers} ownerEmail={user?.email} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && (
          <PaymentStep
            orderLines={[
              { label: `Population Pool — ${selected.length} towns`, value: '' },
              { label: 'Combined population', value: `${totalPop.toLocaleString()} residents` },
              { label: `Tier: ${tier.charAt(0).toUpperCase() + tier.slice(1)}`, value: `${buckets} buckets × $${price}/mo` },
              { label: 'Analyses/month', value: `${totalCap}` },
            ]}
            totalMonthly={totalPrice}
            autoApproveHours={pricing.auto_approve_hours}
            onBack={() => setStep(3)}
            onSubmit={handlePayment}
          />
        )}
      </div>

      {/* Bucket warning modal */}
      {bucketWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#1A3226]">New Pricing Bucket</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Adding <strong>{bucketWarning.territory.city_town}</strong> ({(bucketWarning.territory.population || 0).toLocaleString()} residents) will open Bucket {bucketWarning.newBuckets}.
                  Your price will increase from <strong>${(price * buckets).toFixed(0)}/mo</strong> to <strong>${(bucketWarning.newPrice).toFixed(0)}/mo</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setBucketWarning(null)}>Cancel</Button>
              <Button size="sm" onClick={confirmAdd} className="bg-[#1A3226] text-white">Yes, Add Town</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}