import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";
import TierSelector from "./TierSelector";
import BrokerageInfoStep from "./BrokerageInfoStep";
import TeamMembersStep from "./TeamMembersStep";
import PaymentStep from "./PaymentStep";

const STEPS = ["Build Pool", "Tier", "Brokerage", "Team", "Payment"];

function getBuckets(population, bucketSize) {
  return Math.ceil(population / bucketSize) || 0;
}

export default function PoolFlow({ pricing, user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedTowns, setSelectedTowns] = useState([]);
  const [stateMap, setStateMap] = useState({});
  const [countyMap, setCountyMap] = useState({});
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [pendingAdd, setPendingAdd] = useState(null); // town that would cross bucket threshold
  const [tier, setTier] = useState("starter");
  const [brokerage, setBrokerage] = useState({});
  const [members, setMembers] = useState([]);

  const bucketSize = parseInt(pricing?.territory_seat_size || 50000);
  const tierPrice = parseFloat(pricing?.[`${tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing?.[`${tier}_analyses_cap`] || 0);

  const totalPop = selectedTowns.reduce((s, t) => s + (t.population || 0), 0);
  const bucketsUsed = getBuckets(totalPop, bucketSize);
  const totalPrice = bucketsUsed * tierPrice;
  const totalCap = bucketsUsed * tierCap;
  const nextBucketAt = bucketsUsed * bucketSize;
  const remaining = nextBucketAt - totalPop;

  const loadMeta = async (stateId, countyId) => {
    if (stateId && !stateMap[stateId]) {
      const rows = await base44.entities.State.filter({ id: stateId });
      if (rows[0]) setStateMap(m => ({ ...m, [stateId]: rows[0] }));
    }
    if (countyId && !countyMap[countyId]) {
      const rows = await base44.entities.County.filter({ id: countyId });
      if (rows[0]) setCountyMap(m => ({ ...m, [countyId]: rows[0] }));
    }
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({ city_town: { $regex: q }, status: "available" });
    const filtered = results.filter(r => !selectedTowns.find(s => s.id === r.id)).slice(0, 8);
    setSearchResults(filtered);
  };

  const addTown = (town) => {
    const newPop = totalPop + (town.population || 0);
    const newBuckets = getBuckets(newPop, bucketSize);
    if (newBuckets > bucketsUsed && bucketsUsed > 0) {
      setPendingAdd({ town, newPop, newBuckets, oldBuckets: bucketsUsed });
      return;
    }
    confirmAdd(town);
  };

  const confirmAdd = (town) => {
    setSelectedTowns(t => [...t, town]);
    loadMeta(town.state_id, town.county_id);
    setSearchResults([]);
    setSearchQ("");
    setPendingAdd(null);
  };

  const removeTown = (id) => setSelectedTowns(t => t.filter(x => x.id !== id));

  const buildSummary = () => {
    const rows = [
      { label: `Population Pool — ${selectedTowns.length} towns`, value: "" },
      { label: `Combined population`, value: `${totalPop.toLocaleString()} residents` },
      { label: `Buckets`, value: `${bucketsUsed} × ${bucketSize.toLocaleString()}` },
      { label: `Tier`, value: tier.charAt(0).toUpperCase() + tier.slice(1) },
      { label: `${bucketsUsed} buckets × $${tierPrice.toFixed(2)}`, value: `$${totalPrice.toFixed(2)}/mo`, bold: true },
      { label: `Analyses/month`, value: `${totalCap}` },
    ];
    return rows;
  };

  const handlePaymentSuccess = async (paymentMethodId, setupIntentId) => {
    const autoApproveHours = parseInt(pricing?.auto_approve_hours || 48);
    const autoAt = new Date(Date.now() + autoApproveHours * 60 * 60 * 1000).toISOString();

    const pool = await base44.entities.PopulationPool.create({
      owner_user_id: user.id,
      tier,
      territory_ids: selectedTowns.map(t => t.id),
      combined_population: totalPop,
      buckets_used: bucketsUsed,
      monthly_price: totalPrice,
      analyses_cap: totalCap,
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: "pending_approval",
    });

    await base44.entities.TerritoryClaimRequest.create({
      user_id: user.id,
      brokerage_name: brokerage.brokerage_name,
      brokerage_license: brokerage.brokerage_license,
      agent_count: parseInt(brokerage.agent_count),
      tier_requested: tier,
      type_requested: "multi_bundle",
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
      status: "pending",
      auto_approve_at: autoAt,
    });

    navigate(`/claim/submitted?type=pool&tier=${tier}&towns=${selectedTowns.length}&price=${totalPrice.toFixed(2)}`);
  };

  return (
    <div>
      <StepHeader steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[#1A3226]">Build Your Population Pool</h2>
            <p className="text-sm text-[#1A3226]/60 mt-1">Add towns to your pool. You pay per {bucketSize.toLocaleString()} residents — not per town.</p>
          </div>

          {/* Pool meter */}
          {selectedTowns.length > 0 && (
            <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-3">
              <div className="flex justify-between text-sm text-[#1A3226]">
                <span className="font-medium">Combined population</span>
                <span className="font-bold">{totalPop.toLocaleString()}</span>
              </div>
              <div className="w-full h-3 bg-[#1A3226]/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#B8982F] rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((totalPop % bucketSize) / bucketSize) * 100 || (totalPop > 0 ? 100 : 0))}%` }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#1A3226]/60">
                <div><span className="font-semibold text-[#1A3226]">{bucketsUsed}</span> bucket{bucketsUsed !== 1 ? "s" : ""} used</div>
                <div><span className="font-semibold text-[#1A3226]">{remaining.toLocaleString()}</span> until next bucket</div>
                <div><span className="font-semibold text-[#1A3226]">${(bucketsUsed * parseFloat(pricing?.starter_monthly_price || 0)).toFixed(2)}</span> starter/mo</div>
                <div><span className="font-semibold text-[#1A3226]">{bucketsUsed * parseInt(pricing?.starter_analyses_cap || 0)}</span> analyses/mo</div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <input
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search available towns…"
              className="w-full h-10 border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#1A3226]/10 rounded-xl shadow-lg mt-1 overflow-hidden">
                {searchResults.map(r => (
                  <button key={r.id} onClick={() => addTown(r)}
                    className="w-full text-left px-4 py-3 hover:bg-[#1A3226]/5 transition-colors border-b border-[#1A3226]/5 last:border-0">
                    <p className="text-sm font-medium text-[#1A3226]">{r.city_town}</p>
                    <p className="text-xs text-[#1A3226]/50">Population: {(r.population || 0).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Town list */}
          {selectedTowns.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1A3226]/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#1A3226]">{t.city_town}</p>
                <p className="text-xs text-[#1A3226]/50">{stateMap[t.state_id]?.code} · {countyMap[t.county_id]?.name} · {(t.population || 0).toLocaleString()} residents</p>
              </div>
              <button onClick={() => removeTown(t.id)} className="text-[#1A3226]/30 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {selectedTowns.length === 0 && (
            <p className="text-sm text-[#1A3226]/40 text-center py-6">Search and add towns to build your pool.</p>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => navigate("/claim")}>← Back</Button>
            <Button onClick={() => setStep(1)} disabled={selectedTowns.length === 0} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Continue →</Button>
          </div>
        </div>
      )}

      {/* Bucket crossing modal */}
      {pendingAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-[#1A3226]">Opening a New Bucket</h3>
            <p className="text-sm text-[#1A3226]/70">
              Adding <strong>{pendingAdd.town.city_town}</strong> ({(pendingAdd.town.population || 0).toLocaleString()} residents) will bring your pool to{" "}
              <strong>{pendingAdd.newPop.toLocaleString()}</strong> residents, opening Bucket {pendingAdd.newBuckets}.
            </p>
            <p className="text-sm text-[#1A3226]/70">
              Your monthly price will increase from <strong>${(pendingAdd.oldBuckets * parseFloat(pricing?.starter_monthly_price || 0)).toFixed(2)}</strong> to{" "}
              <strong>${(pendingAdd.newBuckets * parseFloat(pricing?.starter_monthly_price || 0)).toFixed(2)}</strong> (Starter tier).
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setPendingAdd(null)}>Cancel</Button>
              <Button onClick={() => confirmAdd(pendingAdd.town)} className="bg-[#1A3226] text-white">Yes, Add Town</Button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <TierSelector
          pricing={pricing}
          selected={tier}
          onChange={setTier}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
          priceOverride={(tierKey, base) => ({ base: bucketsUsed * base, discounted: bucketsUsed * base })}
        />
      )}
      {step === 2 && <BrokerageInfoStep data={brokerage} onChange={setBrokerage} tier={tier} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <TeamMembersStep members={members} onChange={setMembers} ownerEmail={user?.email} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <PaymentStep pricing={pricing} summary={buildSummary()} onSuccess={handlePaymentSuccess} onBack={() => setStep(3)} />}
    </div>
  );
}