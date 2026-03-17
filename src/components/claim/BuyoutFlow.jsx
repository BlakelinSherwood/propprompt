import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";
import TierSelector from "./TierSelector";
import BrokerageInfoStep from "./BrokerageInfoStep";
import PaymentStep from "./PaymentStep";

const STEPS = ["City Confirmation", "Tier", "Brokerage", "Payment"];

function getBuyoutDiscount(seats, pricing) {
  if (seats === 2) return parseFloat(pricing?.buyout_2seat_discount || 0);
  if (seats <= 4) return parseFloat(pricing?.buyout_3_4seat_discount || 0);
  if (seats <= 9) return parseFloat(pricing?.buyout_5_9seat_discount || 0);
  return parseFloat(pricing?.buyout_10plus_seat_discount || 0);
}

export default function BuyoutFlow({ pricing, territoryId, user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [territory, setTerritory] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [tier, setTier] = useState("pro");
  const [brokerage, setBrokerage] = useState({});

  useEffect(() => {
    if (territoryId) loadTerritory(territoryId);
    else setLoading(false);
  }, [territoryId]);

  const loadTerritory = async (id) => {
    setLoading(true);
    const rows = await base44.entities.Territory.filter({ id });
    const t = rows[0];
    if (t) {
      setTerritory(t);
      const stateRows = await base44.entities.State.filter({ id: t.state_id });
      setState(stateRows[0]);
    }
    setLoading(false);
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({ city_town: { $regex: q } });
    setSearchResults(results.filter(r => (r.seats_total || 1) > 1).slice(0, 8));
  };

  const seats = territory?.seats_total || 1;
  const claimed = territory?.seats_claimed || 0;
  const tierPrice = parseFloat(pricing?.[`${tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing?.[`${tier}_analyses_cap`] || 0);
  const discountPct = territory ? getBuyoutDiscount(seats, pricing) : 0;
  const basePrice = seats * tierPrice;
  const discountAmt = basePrice * (discountPct / 100);
  const finalPrice = basePrice - discountAmt;
  const savings = discountAmt;

  const buildSummary = () => [
    { label: `${territory?.city_town}, ${state?.code} — Full City Buyout`, value: "" },
    { label: `${seats} seats · ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`, value: "" },
    { label: `Base price`, value: `$${basePrice.toFixed(2)}/mo` },
    discountPct > 0 ? { label: `Buyout discount (${discountPct}%)`, value: `-$${discountAmt.toFixed(2)}/mo`, discount: true } : null,
    { label: `Your price`, value: `$${finalPrice.toFixed(2)}/mo`, bold: true },
    { label: `You save`, value: `$${savings.toFixed(2)}/mo` },
    { label: `Analyses/month`, value: `${seats * tierCap}` },
  ].filter(Boolean);

  const handlePaymentSuccess = async (paymentMethodId, setupIntentId) => {
    const autoApproveHours = parseInt(pricing?.auto_approve_hours || 48);
    const autoAt = new Date(Date.now() + autoApproveHours * 60 * 60 * 1000).toISOString();

    await base44.entities.FullBuyoutSubscription.create({
      territory_id: territory.id,
      user_id: user.id,
      tier,
      seats_total: seats,
      base_price: basePrice,
      discount_pct: discountPct,
      monthly_price: finalPrice,
      analyses_cap: seats * tierCap,
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: "pending_approval",
      brokerage_name: brokerage.brokerage_name,
      brokerage_license: brokerage.brokerage_license,
      agent_count: parseInt(brokerage.agent_count),
    });

    await base44.entities.TerritoryClaimRequest.create({
      territory_id: territory.id,
      user_id: user.id,
      brokerage_name: brokerage.brokerage_name,
      brokerage_license: brokerage.brokerage_license,
      agent_count: parseInt(brokerage.agent_count),
      tier_requested: tier,
      type_requested: "county_bundle",
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: "pending",
      auto_approve_at: autoAt,
    });

    navigate(`/claim/submitted?type=buyout&tier=${tier}&city=${encodeURIComponent(territory.city_town)}&price=${finalPrice.toFixed(2)}`);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" /></div>;

  return (
    <div>
      <StepHeader steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[#1A3226]">Full City Buyout</h2>
            <p className="text-sm text-[#1A3226]/60 mt-1">Own every seat in a multi-seat city for complete exclusivity.</p>
          </div>

          {!territory ? (
            <div className="relative">
              <input
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search multi-seat cities…"
                className="w-full h-10 border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#1A3226]/10 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => { loadTerritory(r.id); setSearchResults([]); setSearchQ(""); }}
                      className="w-full text-left px-4 py-3 hover:bg-[#1A3226]/5 transition-colors border-b last:border-0">
                      <p className="text-sm font-medium text-[#1A3226]">{r.city_town}</p>
                      <p className="text-xs text-[#1A3226]/50">{r.seats_total} seats · {r.seats_claimed || 0} claimed</p>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" className="mt-4" onClick={() => navigate("/claim")}>← Back to Claim Types</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[#1A3226] text-lg">{territory.city_town}</h3>
                    <p className="text-sm text-[#1A3226]/50">{state?.name}</p>
                  </div>
                  <button onClick={() => { setTerritory(null); setState(null); }} className="text-xs text-[#1A3226]/40 hover:text-[#1A3226]">Change</button>
                </div>

                {claimed > 0 ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">
                        Full buyout is not available — <strong>{claimed} seat{claimed !== 1 ? "s" : ""}</strong> in {territory.city_town} are already claimed. You can claim individual available seats.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/claim?type=single&territory_id=${territory.id}`)}>
                      Claim Available Seats →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pricing breakdown */}
                    <div className="rounded-lg bg-[#1A3226]/[0.03] p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#1A3226]/60">{seats} seats × ${tierPrice.toFixed(2)} ({tier})</span>
                        <span className="text-[#1A3226]">${basePrice.toFixed(2)}/mo</span>
                      </div>
                      {discountPct > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>Buyout discount ({discountPct}%)</span>
                          <span>-${discountAmt.toFixed(2)}/mo</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-[#1A3226] pt-1 border-t border-[#1A3226]/10">
                        <span>Your price</span>
                        <span>${finalPrice.toFixed(2)}/mo</span>
                      </div>
                      {savings > 0 && (
                        <p className="text-xs text-emerald-600">You save ${savings.toFixed(2)}/mo vs claiming seats individually</p>
                      )}
                      <p className="text-xs text-[#1A3226]/50">{seats * tierCap} analyses/month</p>
                    </div>

                    {/* Exclusivity badge preview */}
                    <div className="rounded-xl border-2 border-[#B8982F]/40 bg-gradient-to-br from-[#1A3226] to-[#1A3226]/80 text-white p-5 text-center space-y-2">
                      <Shield className="w-8 h-8 text-[#B8982F] mx-auto" />
                      <p className="font-bold text-sm">The Only PropPrompt Partner in {territory.city_town}, {state?.code}</p>
                      <p className="text-xs text-white/60">This badge will appear on every report you generate.</p>
                    </div>
                  </div>
                )}
              </div>

              {claimed === 0 && (
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => navigate("/claim")}>← Back</Button>
                  <Button onClick={() => setStep(1)} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Continue →</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <TierSelector
          pricing={pricing}
          selected={tier}
          onChange={setTier}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
          priceOverride={(tierKey, base) => {
            const disc = getBuyoutDiscount(seats, pricing);
            const bp = seats * base;
            return { base: bp, discounted: bp * (1 - disc / 100) };
          }}
        />
      )}
      {step === 2 && <BrokerageInfoStep data={brokerage} onChange={setBrokerage} tier={tier} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <PaymentStep pricing={pricing} summary={buildSummary()} onSuccess={handlePaymentSuccess} onBack={() => setStep(2)} />}
    </div>
  );
}