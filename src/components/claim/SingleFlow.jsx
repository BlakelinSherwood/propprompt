import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";
import TierSelector from "./TierSelector";
import BrokerageInfoStep from "./BrokerageInfoStep";
import PaymentStep from "./PaymentStep";

const STEPS = ["Territory", "Tier", "Brokerage", "Payment"];

export default function SingleFlow({ pricing, territoryId, user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [territory, setTerritory] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockMsg, setBlockMsg] = useState("");
  const [tier, setTier] = useState("starter");
  const [seatNumber, setSeatNumber] = useState(1);
  const [brokerage, setBrokerage] = useState({});
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (territoryId) loadTerritory(territoryId);
    else setLoading(false);
  }, [territoryId]);

  const loadTerritory = async (id) => {
    setLoading(true);
    const rows = await base44.entities.Territory.filter({ id });
    const t = rows[0];
    if (!t) { setLoading(false); return; }
    const stateRows = await base44.entities.State.filter({ id: t.state_id });
    setState(stateRows[0]);
    checkBlocked(t);
    setTerritory(t);
    const avail = (t.seats_total || 1) - (t.seats_claimed || 0);
    setSeatNumber(avail > 0 ? (t.seats_claimed || 0) + 1 : 1);
    setLoading(false);
  };

  const checkBlocked = (t) => {
    if ((t.seats_claimed || 0) >= (t.seats_total || 1)) {
      setBlockMsg("This territory is fully claimed.");
    }
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({ city_town: { $regex: q } });
    setSearchResults(results.filter(r => r.status === "available" || (r.seats_claimed || 0) < (r.seats_total || 1)).slice(0, 8));
  };

  const buildSummary = () => {
    const price = parseFloat(pricing[`${tier}_monthly_price`] || 0);
    const cap = parseInt(pricing[`${tier}_analyses_cap`] || 0);
    return [
      { label: `${territory?.city_town || ""}, ${state?.code || ""} — Seat #${seatNumber}`, value: "" },
      { label: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`, value: `$${price.toFixed(2)}/mo` },
      { label: "Analyses included", value: `${cap}/mo` },
      { label: "Monthly total", value: `$${price.toFixed(2)}/mo`, bold: true },
    ];
  };

  const handlePaymentSuccess = async (paymentMethodId, setupIntentId) => {
    const autoApproveHours = parseInt(pricing?.auto_approve_hours || 48);
    const autoAt = new Date(Date.now() + autoApproveHours * 60 * 60 * 1000).toISOString();
    await base44.entities.TerritoryClaimRequest.create({
      territory_id: territory.id,
      user_id: user.id,
      brokerage_name: brokerage.brokerage_name,
      brokerage_license: brokerage.brokerage_license,
      agent_count: parseInt(brokerage.agent_count),
      tier_requested: tier,
      type_requested: "single",
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: "pending",
      auto_approve_at: autoAt,
    });
    navigate("/claim/submitted?type=single&tier=" + tier + "&territory=" + encodeURIComponent(territory.city_town));
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" /></div>;

  return (
    <div>
      <StepHeader steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[#1A3226]">Select Your Territory</h2>
            <p className="text-sm text-[#1A3226]/60 mt-1">Search for the town or city you want to claim.</p>
          </div>

          {!territory ? (
            <div className="relative">
              <input
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search towns, cities…"
                className="w-full h-10 border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#1A3226]/10 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => { loadTerritory(r.id); setSearchResults([]); setSearchQ(""); }}
                      className="w-full text-left px-4 py-3 hover:bg-[#1A3226]/5 transition-colors border-b border-[#1A3226]/5 last:border-0">
                      <p className="text-sm font-medium text-[#1A3226]">{r.city_town}</p>
                      <p className="text-xs text-[#1A3226]/50">
                        {r.seats_total || 1} seat{(r.seats_total || 1) > 1 ? "s" : ""} · {r.seats_claimed || 0} claimed · Status: {r.status}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#1A3226]/5 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#1A3226]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1A3226]">{territory.city_town}</h3>
                    <p className="text-xs text-[#1A3226]/50">{state?.name}</p>
                  </div>
                </div>
                <button onClick={() => { setTerritory(null); setBlockMsg(""); }} className="text-xs text-[#1A3226]/40 hover:text-[#1A3226]">Change</button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-[#1A3226]/[0.03] p-3 text-center">
                  <p className="text-lg font-bold text-[#1A3226]">{territory.seats_total || 1}</p>
                  <p className="text-xs text-[#1A3226]/50">Total Seats</p>
                </div>
                <div className="rounded-lg bg-[#1A3226]/[0.03] p-3 text-center">
                  <p className="text-lg font-bold text-[#1A3226]">{territory.seats_claimed || 0}</p>
                  <p className="text-xs text-[#1A3226]/50">Claimed</p>
                </div>
                <div className="rounded-lg bg-[#1A3226]/[0.03] p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{(territory.seats_total || 1) - (territory.seats_claimed || 0)}</p>
                  <p className="text-xs text-[#1A3226]/50">Available</p>
                </div>
              </div>

              {territory.population && (
                <p className="text-xs text-[#1A3226]/50">Population: {territory.population.toLocaleString()}</p>
              )}

              {(territory.seats_total || 1) > 1 && !blockMsg && (
                <div>
                  <p className="text-sm font-medium text-[#1A3226] mb-2">Select Your Seat</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: territory.seats_total || 1 }, (_, i) => i + 1).map(n => {
                      const isClaimed = n <= (territory.seats_claimed || 0);
                      return (
                        <button key={n} disabled={isClaimed}
                          onClick={() => setSeatNumber(n)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                            isClaimed ? "bg-red-50 text-red-300 cursor-not-allowed" :
                            seatNumber === n ? "bg-[#1A3226] text-white" :
                            "bg-[#1A3226]/5 text-[#1A3226] hover:bg-[#1A3226]/10"
                          }`}>
                          {isClaimed ? "✗" : n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {blockMsg && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {blockMsg}
                </div>
              )}
            </div>
          )}

          {territory && !blockMsg && (
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => navigate("/claim")}>Back</Button>
              <Button onClick={() => setStep(1)} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Continue →</Button>
            </div>
          )}
          {!territory && (
            <div className="flex justify-start pt-2">
              <Button variant="outline" onClick={() => navigate("/claim")}>← Back to Claim Types</Button>
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
        />
      )}

      {step === 2 && (
        <BrokerageInfoStep
          data={brokerage}
          onChange={setBrokerage}
          tier={tier}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <PaymentStep
          pricing={pricing}
          summary={buildSummary()}
          onSuccess={handlePaymentSuccess}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}