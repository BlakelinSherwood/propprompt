import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePricing } from '@/components/pricing/usePricing';
import TierSelector from './TierSelector';
import BrokerageInfoStep from './BrokerageInfoStep';
import PaymentStep from './PaymentStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, AlertCircle, Search } from 'lucide-react';

const STEPS = ['City Confirmation', 'Tier', 'Brokerage', 'Payment'];

function getBuyoutDiscount(seats, pricing) {
  if (seats >= 10) return parseFloat(pricing.buyout_10plus_seat_discount || 0);
  if (seats >= 5) return parseFloat(pricing.buyout_5_9seat_discount || 0);
  if (seats >= 3) return parseFloat(pricing.buyout_3_4seat_discount || 0);
  if (seats === 2) return parseFloat(pricing.buyout_2seat_discount || 0);
  return 0;
}

export default function BuyoutFlow({ territoryId }) {
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();
  const [step, setStep] = useState(0);
  const [territory, setTerritory] = useState(null);
  const [state, setState] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [tier, setTier] = useState('pro');
  const [brokerageInfo, setBrokerageInfo] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    if (territoryId) loadTerritory(territoryId);
  }, [territoryId]);

  const loadTerritory = async (id) => {
    const [ts, states] = await Promise.all([
      base44.entities.Territory.filter({ id }),
      base44.entities.State.list(),
    ]);
    const t = ts[0];
    if (t) { setTerritory(t); setState(states.find(s => s.id === t.state_id)); }
  };

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({});
    setSearchResults(results.filter(t => (t.seats_total || 1) > 1 && t.city_town?.toLowerCase().includes(q.toLowerCase())).slice(0, 10));
  };

  const selectTerritory = (t) => {
    setTerritory(t);
    setSearch('');
    setSearchResults([]);
    base44.entities.State.filter({ id: t.state_id }).then(states => setState(states[0]));
  };

  const handlePayment = async (paymentMethodId, setupIntentId) => {
    const seats = territory.seats_total || 2;
    const discount = getBuyoutDiscount(seats, pricing);
    const tierPrice = parseFloat(pricing[`${tier}_monthly_price`] || 0);
    const basePrice = tierPrice * seats;
    const finalPrice = basePrice * (1 - discount / 100);
    const autoApproveAt = new Date(Date.now() + (parseInt(pricing.auto_approve_hours || 48)) * 3600000).toISOString();
    const buyout = await base44.entities.FullBuyoutSubscription.create({
      territory_id: territory.id, user_id: user?.id, tier,
      seats_total: seats, base_monthly_price: basePrice, discount_pct: discount, monthly_price: finalPrice,
      stripe_setup_intent_id: setupIntentId, stripe_payment_method_id: paymentMethodId,
    });
    await base44.entities.TerritoryClaimRequest.create({
      territory_id: territory.id, buyout_id: buyout.id, user_id: user?.id,
      brokerage_name: brokerageInfo.brokerage_name, brokerage_license: brokerageInfo.brokerage_license, agent_count: parseInt(brokerageInfo.agent_count),
      tier_requested: tier, type_requested: 'full_buyout',
      stripe_payment_method_id: paymentMethodId, stripe_setup_intent_id: setupIntentId,
      status: 'pending', auto_approve_at: autoApproveAt,
    });
    navigate('/claim/submitted', { state: { claimType: 'buyout', territories: [territory], tier, monthlyPrice: finalPrice, seats, stateName: state?.code } });
  };

  if (pricingLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" /></div>;

  const seats = territory?.seats_total || 2;
  const claimed = territory?.seats_claimed || 0;
  const tierPrice = parseFloat(pricing[`${tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing[`${tier}_analyses_cap`] || 0);
  const basePrice = tierPrice * seats;
  const discount = getBuyoutDiscount(seats, pricing);
  const finalPrice = basePrice * (1 - discount / 100);
  const savings = basePrice - finalPrice;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[#1A3226] text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm hidden sm:block ${i === step ? 'font-medium text-[#1A3226]' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#1A3226]">Full City Buyout</h2>
              <p className="text-sm text-gray-500 mt-1">Claim every seat in a multi-seat city for complete exclusivity.</p>
            </div>

            {!territory && (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Search multi-seat cities…" value={search} onChange={e => handleSearch(e.target.value)} />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                    {searchResults.map(t => (
                      <button key={t.id} type="button" onClick={() => selectTerritory(t)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex justify-between text-sm">
                        <span>{t.city_town}</span>
                        <span className="text-gray-400">{t.seats_total} seats</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {territory && claimed > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700">Full buyout not available</p>
                    <p className="text-sm text-red-600 mt-1">{claimed} seat{claimed > 1 ? 's' : ''} in {territory.city_town} {claimed > 1 ? 'are' : 'is'} already claimed. You can claim individual available seats.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button size="sm" variant="outline" onClick={() => setTerritory(null)}>Choose Another City</Button>
                  <Button size="sm" className="bg-[#1A3226] text-white" onClick={() => navigate(`/claim?type=single&territory_id=${territory.id}`)}>Claim Available Seats →</Button>
                </div>
              </div>
            )}

            {territory && claimed === 0 && (
              <>
                <div className="rounded-xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#1A3226]">{territory.city_town}, {state?.code}</h3>
                      <p className="text-sm text-gray-500">{seats} seats · {(territory.population || 0).toLocaleString()} residents</p>
                    </div>
                    <button onClick={() => { setTerritory(null); setState(null); }} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-400 text-xs">Base price</div>
                      <div className="font-semibold text-[#1A3226]">{seats} × ${tierPrice}/mo = ${basePrice.toFixed(0)}/mo</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <div className="text-gray-400 text-xs">Buyout discount ({discount}%)</div>
                      <div className="font-semibold text-emerald-700">-${savings.toFixed(0)}/mo</div>
                    </div>
                    <div className="bg-[#1A3226]/5 rounded-lg p-3 col-span-2">
                      <div className="text-gray-400 text-xs">Your price</div>
                      <div className="text-2xl font-bold text-[#1A3226]">${finalPrice.toFixed(0)}/mo</div>
                      <div className="text-xs text-gray-400">{seats * tierCap} analyses/month</div>
                    </div>
                  </div>
                </div>

                {/* Exclusive badge preview */}
                <div className="rounded-xl border-2 border-[#B8982F]/40 bg-[#B8982F]/5 p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#1A3226] flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-[#B8982F]" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#B8982F] font-semibold mb-1">Badge Preview</p>
                    <p className="font-semibold text-[#1A3226]">The Only PropPrompt Partner in {territory.city_town}, {state?.code}</p>
                    <p className="text-xs text-gray-500 mt-1">This badge will appear on every report you generate.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(1)} className="bg-[#1A3226] text-white">Continue →</Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#1A3226]">Select Your Tier</h2>
            <TierSelector pricing={pricing} selectedTier={tier} onChange={setTier} />
            <div className="rounded-lg bg-[#1A3226]/5 border border-[#1A3226]/10 p-3 text-sm">
              {seats} seats × ${tierPrice}/mo − {discount}% discount = <strong>${finalPrice.toFixed(0)}/mo</strong>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>← Back</Button>
              <Button onClick={() => setStep(2)} className="bg-[#1A3226] text-white">Continue →</Button>
            </div>
          </div>
        )}

        {step === 2 && <BrokerageInfoStep data={brokerageInfo} onChange={setBrokerageInfo} tier={tier} onBack={() => setStep(1)} onNext={() => setStep(3)} />}

        {step === 3 && territory && (
          <PaymentStep
            orderLines={[
              { label: `${territory.city_town}, ${state?.code} — Full City Buyout`, value: '' },
              { label: `${seats} seats · ${tier.charAt(0).toUpperCase() + tier.slice(1)}`, value: `$${basePrice.toFixed(0)}/mo base` },
              { label: `Buyout discount (${discount}%)`, value: `-$${savings.toFixed(0)}/mo` },
              { label: 'You save', value: `$${savings.toFixed(0)}/mo vs individual seats` },
              { label: 'Analyses/month', value: `${seats * tierCap}` },
            ]}
            totalMonthly={finalPrice}
            autoApproveHours={pricing.auto_approve_hours}
            onBack={() => setStep(2)}
            onSubmit={handlePayment}
          />
        )}
      </div>
    </div>
  );
}