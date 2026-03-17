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
import { X } from 'lucide-react';

const STEPS = ['Select Territories', 'Tier', 'Brokerage', 'Team', 'Payment'];

function getBundleTier(count, pricing) {
  if (count >= 20) return { name: 'Master', discount: parseFloat(pricing.bundle_master_discount || 0) };
  if (count >= 10) return { name: 'District', discount: parseFloat(pricing.bundle_district_discount || 0) };
  if (count >= 5) return { name: 'Regional', discount: parseFloat(pricing.bundle_regional_discount || 0) };
  if (count >= 3) return { name: 'Trio', discount: parseFloat(pricing.bundle_trio_discount || 0) };
  if (count >= 2) return { name: 'Duo', discount: parseFloat(pricing.bundle_duo_discount || 0) };
  return { name: null, discount: 0 };
}

export default function BundleFlow({ territoryId }) {
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

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Territory.filter({ status: 'available' }).then(setAllTerritories);
  }, []);

  useEffect(() => {
    if (territoryId && allTerritories.length) {
      const t = allTerritories.find(t => t.id === territoryId);
      if (t && !selected.find(s => s.id === t.id)) setSelected([t]);
    }
  }, [territoryId, allTerritories]);

  const bundleTier = getBundleTier(selected.length, pricing);
  const basePrice = selected.reduce((sum, t) => sum + parseFloat(pricing[`${tier}_monthly_price`] || 0), 0);
  const discountAmt = basePrice * (bundleTier.discount / 100);
  const finalPrice = basePrice - discountAmt;

  const filtered = allTerritories.filter(t =>
    !selected.find(s => s.id === t.id) &&
    t.city_town?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  const handlePayment = async (paymentMethodId, setupIntentId) => {
    const autoApproveAt = new Date(Date.now() + (parseInt(pricing.auto_approve_hours || 48)) * 3600000).toISOString();
    const bundleNameMap = { Master: 'master', District: 'district', Regional: 'regional', Trio: 'trio', Duo: 'duo' };
    const bundle = await base44.entities.TerritoryBundle.create({
      owner_user_id: user?.id,
      bundle_name: bundleNameMap[bundleTier.name] || 'duo',
      bundle_type: 'multi_town',
      tier,
      territory_count: selected.length,
      discount_pct: bundleTier.discount,
      base_price: basePrice,
      discounted_price: finalPrice,
      status: 'pending_approval',
    });
    await Promise.all(selected.map((t, i) =>
      base44.entities.TerritoryBundleMember.create({ bundle_id: bundle.id, territory_id: t.id, seat_number: i + 1, joined_at: new Date().toISOString() })
    ));
    await base44.entities.BundleUserMember.create({ bundle_id: bundle.id, user_id: user?.id, role: 'owner', status: 'active', accepted_at: new Date().toISOString() });
    await Promise.all(teamMembers.map(m =>
      base44.entities.BundleUserMember.create({ bundle_id: bundle.id, user_id: m.email, role: m.role, status: 'pending', invited_at: new Date().toISOString() })
    ));
    await base44.entities.TerritoryClaimRequest.create({
      bundle_id: bundle.id, user_id: user?.id,
      brokerage_name: brokerageInfo.brokerage_name, brokerage_license: brokerageInfo.brokerage_license, agent_count: parseInt(brokerageInfo.agent_count),
      tier_requested: tier, type_requested: 'multi_bundle',
      stripe_payment_method_id: paymentMethodId, stripe_setup_intent_id: setupIntentId,
      status: 'pending', auto_approve_at: autoApproveAt,
    });
    navigate('/claim/submitted', { state: { claimType: 'bundle', territories: selected, tier, monthlyPrice: finalPrice, bundleName: bundleTier.name, discount: bundleTier.discount } });
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
              <h2 className="text-lg font-semibold text-[#1A3226]">Select Territories</h2>
              <p className="text-sm text-gray-500 mt-1">Add multiple territories. The more you add, the bigger your bundle discount.</p>
            </div>

            {/* Bundle tier badge */}
            {selected.length > 0 && (
              <div className="rounded-xl border bg-indigo-50 border-indigo-200 p-4 flex items-center justify-between">
                <div>
                  {bundleTier.name ? (
                    <>
                      <span className="font-semibold text-indigo-700">{bundleTier.name} Bundle</span>
                      <span className="text-sm text-indigo-500 ml-2">— {bundleTier.discount}% off</span>
                    </>
                  ) : <span className="text-sm text-gray-500">Add {2 - selected.length} more for a Duo bundle discount</span>}
                </div>
                <div className="text-right">
                  {bundleTier.discount > 0 && <div className="text-xs text-gray-400 line-through">${basePrice.toFixed(0)}/mo</div>}
                  <div className="font-bold text-[#1A3226]">${finalPrice.toFixed(0)}/mo</div>
                </div>
              </div>
            )}

            <div className="relative">
              <Input placeholder="Search territories…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                  {filtered.map(t => (
                    <button key={t.id} type="button" onClick={() => { setSelected(prev => [...prev, t]); setSearch(''); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between text-sm">
                      <span>{t.city_town}</span>
                      <span className="text-gray-400 text-xs">{(t.seats_total || 1)} seat{(t.seats_total || 1) > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {selected.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <span className="text-sm text-[#1A3226]">{t.city_town}</span>
                  <button onClick={() => setSelected(prev => prev.filter(s => s.id !== t.id))} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {selected.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Search and add territories above.</p>}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={selected.length < 2} className="bg-[#1A3226] text-white">Continue →</Button>
            </div>
            {selected.length === 1 && <p className="text-xs text-amber-600 text-right">Add at least 2 territories for a bundle.</p>}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#1A3226]">Select Your Tier</h2>
            <TierSelector pricing={pricing} selectedTier={tier} onChange={setTier} />
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-700">
              {bundleTier.name} discount ({bundleTier.discount}%): -${discountAmt.toFixed(0)}/mo → <strong>${finalPrice.toFixed(0)}/mo total</strong>
            </div>
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
              { label: `${selected.length} territories — ${tier.charAt(0).toUpperCase() + tier.slice(1)}`, value: `$${basePrice.toFixed(0)}/mo base` },
              { label: `${bundleTier.name || 'No'} discount (${bundleTier.discount}%)`, value: `-$${discountAmt.toFixed(0)}/mo` },
            ]}
            totalMonthly={finalPrice}
            autoApproveHours={pricing.auto_approve_hours}
            onBack={() => setStep(3)}
            onSubmit={handlePayment}
          />
        )}
      </div>
    </div>
  );
}