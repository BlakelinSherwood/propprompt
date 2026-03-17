import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePricing } from '@/components/pricing/usePricing';
import TierSelector from './TierSelector';
import BrokerageInfoStep from './BrokerageInfoStep';
import PaymentStep from './PaymentStep';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, MapPin } from 'lucide-react';

const STEPS = ['Territory', 'Tier', 'Brokerage', 'Payment'];

export default function SingleFlow({ territoryId }) {
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();
  const [step, setStep] = useState(0);
  const [territory, setTerritory] = useState(null);
  const [state, setState] = useState(null);
  const [county, setCounty] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(1);
  const [tier, setTier] = useState('starter');
  const [brokerageInfo, setBrokerageInfo] = useState({});
  const [user, setUser] = useState(null);
  const [blockReason, setBlockReason] = useState(null);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me().catch(() => null);
      setUser(me);
      if (!territoryId) return;
      const [territories, states, counties] = await Promise.all([
        base44.entities.Territory.filter({ id: territoryId }),
        base44.entities.State.list(),
        base44.entities.County.list(),
      ]);
      const t = territories[0];
      if (!t) return;
      setTerritory(t);
      setState(states.find(s => s.id === t.state_id));
      setCounty(counties.find(c => c.id === t.county_id));

      // Validate availability
      const total = t.seats_total || 1;
      const claimed = t.seats_claimed || 0;
      if (claimed >= total) { setBlockReason('All seats in this territory are already claimed.'); return; }

      // Check rejection cooldown
      const rejDays = parseInt(pricing.rejection_recliam_days || 30);
      const since = new Date(Date.now() - rejDays * 24 * 60 * 60 * 1000).toISOString();
      const recentRejects = await base44.entities.TerritoryClaimRequest.filter({ territory_id: territoryId, status: 'rejected' });
      const recent = recentRejects.filter(r => r.rejected_at && r.rejected_at > since && r.user_id === me?.id);
      if (recent.length) setBlockReason(`You were rejected for this territory within the last ${rejDays} days.`);
    }
    if (!pricingLoading) load();
  }, [territoryId, pricingLoading]);

  const handlePayment = async (paymentMethodId, setupIntentId) => {
    const autoApproveAt = new Date(Date.now() + (parseInt(pricing.auto_approve_hours || 48)) * 3600000).toISOString();
    await base44.entities.TerritoryClaimRequest.create({
      territory_id: territoryId,
      user_id: user?.id,
      brokerage_name: brokerageInfo.brokerage_name,
      brokerage_license: brokerageInfo.brokerage_license,
      agent_count: parseInt(brokerageInfo.agent_count),
      tier_requested: tier,
      type_requested: 'single',
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: 'pending',
      auto_approve_at: autoApproveAt,
    });
    navigate('/claim/submitted', { state: { claimType: 'single', territories: [territory], tier, monthlyPrice: pricing[`${tier}_monthly_price`] } });
  };

  if (pricingLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" /></div>;

  const price = parseFloat(pricing[`${tier}_monthly_price`] || 0);
  const cap = parseInt(pricing[`${tier}_analyses_cap`] || 0);
  const total = territory?.seats_total || 1;
  const claimed = territory?.seats_claimed || 0;
  const availableSeats = Array.from({ length: total }, (_, i) => i + 1).slice(claimed);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
              ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[#1A3226] text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-medium text-[#1A3226]' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8">
        {blockReason && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Not Available</p>
              <p className="text-sm text-red-600">{blockReason}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/territories')}>← Back to Map</Button>
            </div>
          </div>
        )}

        {!blockReason && step === 0 && territory && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1A3226]">Confirm Territory</h2>
              <p className="text-sm text-gray-500 mt-1">Review this territory before selecting your tier.</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#1A3226]/5 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#1A3226]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[#1A3226]">{territory.city_town}</h3>
                <p className="text-sm text-gray-500">{county?.name}, {state?.code}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Population: {(territory.population || 0).toLocaleString()}</span>
                  <span>Total seats: {total}</span>
                  <span>Available: {total - claimed}</span>
                </div>
              </div>
            </div>
            {total > 1 && (
              <div>
                <label className="text-sm font-medium text-[#1A3226] block mb-2">Select Seat</label>
                <div className="flex flex-wrap gap-2">
                  {availableSeats.map(seatNum => (
                    <button key={seatNum} type="button"
                      onClick={() => setSelectedSeat(seatNum)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${selectedSeat === seatNum ? 'bg-[#1A3226] text-white border-[#1A3226]' : 'border-gray-200 text-gray-600 hover:border-[#1A3226]/30'}`}>
                      Seat {seatNum}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end"><Button onClick={() => setStep(1)} className="bg-[#1A3226] text-white">Continue →</Button></div>
          </div>
        )}

        {!blockReason && step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1A3226]">Select Your Tier</h2>
              <p className="text-sm text-gray-500 mt-1">Choose the plan that fits your business.</p>
            </div>
            <TierSelector pricing={pricing} selectedTier={tier} onChange={setTier} />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>← Back</Button>
              <Button onClick={() => setStep(2)} className="bg-[#1A3226] text-white">Continue →</Button>
            </div>
          </div>
        )}

        {!blockReason && step === 2 && (
          <BrokerageInfoStep data={brokerageInfo} onChange={setBrokerageInfo} tier={tier} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}

        {!blockReason && step === 3 && (
          <PaymentStep
            orderLines={[
              { label: `${territory?.city_town} — ${tier.charAt(0).toUpperCase() + tier.slice(1)} Seat ${total > 1 ? selectedSeat : ''}`, value: `$${price.toFixed(2)}/mo` },
              { label: 'Analyses/month', value: `${cap}` },
            ]}
            totalMonthly={price}
            autoApproveHours={pricing.auto_approve_hours}
            onBack={() => setStep(2)}
            onSubmit={handlePayment}
          />
        )}
      </div>
    </div>
  );
}