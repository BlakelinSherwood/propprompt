import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { X, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";
import TierSelector from "./TierSelector";
import BrokerageInfoStep from "./BrokerageInfoStep";
import TeamMembersStep from "./TeamMembersStep";
import PaymentStep from "./PaymentStep";

const STEPS = ["Select Territories", "Tier", "Brokerage", "Team", "Payment"];

const BUNDLE_TIERS = [
  { name: "Duo", min: 1, max: 2, discountKey: "bundle_duo_discount", multiplierKey: "bundle_duo_cap_multiplier" },
  { name: "Trio", min: 3, max: 4, discountKey: "bundle_trio_discount", multiplierKey: "bundle_trio_cap_multiplier" },
  { name: "Regional", min: 5, max: 9, discountKey: "bundle_regional_discount", multiplierKey: "bundle_regional_cap_multiplier" },
  { name: "District", min: 10, max: 19, discountKey: "bundle_district_discount", multiplierKey: "bundle_district_cap_multiplier" },
  { name: "Master", min: 20, max: Infinity, discountKey: "bundle_master_discount", multiplierKey: "bundle_master_cap_multiplier" },
];

function getBundle(count, pricing) {
  const b = BUNDLE_TIERS.find(t => count >= t.min && count <= t.max);
  if (!b) return null;
  return { ...b, discount: parseFloat(pricing?.[b.discountKey] || 0) };
}

export default function BundleFlow({ pricing, user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [territories, setTerritories] = useState([]);
  const [stateMap, setStateMap] = useState({});
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [tier, setTier] = useState("starter");
  const [brokerage, setBrokerage] = useState({});
  const [members, setMembers] = useState([]);

  const bundle = getBundle(territories.length, pricing);
  const tierPrice = parseFloat(pricing?.[`${tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing?.[`${tier}_analyses_cap`] || 0);
  const baseTotal = territories.length * tierPrice;
  const discountAmt = bundle ? baseTotal * (bundle.discount / 100) : 0;
  const discountedTotal = baseTotal - discountAmt;

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({ city_town: { $regex: q }, status: "available" });
    setSearchResults(results.filter(r => !territories.find(t => t.id === r.id)).slice(0, 8));
  };

  const addTerritory = async (t) => {
    if (!stateMap[t.state_id]) {
      const rows = await base44.entities.State.filter({ id: t.state_id });
      if (rows[0]) setStateMap(m => ({ ...m, [t.state_id]: rows[0] }));
    }
    setTerritories(prev => [...prev, t]);
    setSearchResults([]);
    setSearchQ("");
  };

  const remove = (id) => setTerritories(t => t.filter(x => x.id !== id));

  const buildSummary = () => [
    { label: `Town Bundle — ${territories.length} territories`, value: "" },
    { label: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`, value: "" },
    { label: `Base price`, value: `$${baseTotal.toFixed(2)}/mo` },
    bundle && bundle.discount > 0 ? { label: `${bundle.name} discount (${bundle.discount}%)`, value: `-$${discountAmt.toFixed(2)}/mo`, discount: true } : null,
    { label: `Your price`, value: `$${discountedTotal.toFixed(2)}/mo`, bold: true },
    { label: `Analyses/month`, value: `${territories.length * tierCap}` },
  ].filter(Boolean);

  const handlePaymentSuccess = async (paymentMethodId, setupIntentId) => {
    const autoApproveHours = parseInt(pricing?.auto_approve_hours || 48);
    const autoAt = new Date(Date.now() + autoApproveHours * 60 * 60 * 1000).toISOString();

    const bundleName = bundle?.name?.toLowerCase() || "duo";
    const bundleRecord = await base44.entities.TerritoryBundle.create({
      owner_user_id: user.id,
      bundle_name: bundleName,
      bundle_type: "multi_town",
      tier,
      territory_count: territories.length,
      discount_pct: bundle?.discount || 0,
      base_price: baseTotal,
      discounted_price: discountedTotal,
      analyses_cap: territories.length * tierCap,
      stripe_payment_method_id: paymentMethodId,
      status: "pending_approval",
    });

    for (let i = 0; i < territories.length; i++) {
      await base44.entities.TerritoryBundleMember.create({
        bundle_id: bundleRecord.id,
        territory_id: territories[i].id,
        seat_number: i + 1,
        joined_at: new Date().toISOString(),
      });
    }

    for (const m of [{ email: user.email, role: "owner" }, ...members.map(x => ({ ...x, role: x.role }))]) {
      await base44.entities.BundleUserMember.create({
        bundle_id: bundleRecord.id,
        user_id: m.email,
        role: m.role,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        status: m.role === "owner" ? "active" : "pending",
      });
    }

    await base44.entities.TerritoryClaimRequest.create({
      bundle_id: bundleRecord.id,
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

    navigate(`/claim/submitted?type=bundle&tier=${tier}&towns=${territories.length}&price=${discountedTotal.toFixed(2)}`);
  };

  return (
    <div>
      <StepHeader steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[#1A3226]">Select Territories for Bundle</h2>
            <p className="text-sm text-[#1A3226]/60 mt-1">Add territories to unlock bundle discounts.</p>
          </div>

          {/* Live bundle tier */}
          {territories.length > 0 && (
            <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-4 flex items-center justify-between">
              <div>
                {bundle ? (
                  <>
                    <p className="font-semibold text-[#1A3226]">{bundle.name} Bundle — {bundle.discount}% off</p>
                    <p className="text-xs text-[#1A3226]/50">{territories.length} territories selected</p>
                  </>
                ) : (
                  <p className="text-sm text-[#1A3226]/60">Add territories to unlock discounts</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#1A3226]">${discountedTotal.toFixed(2)}/mo</p>
                {discountAmt > 0 && <p className="text-xs text-emerald-600">Save ${discountAmt.toFixed(2)}/mo (Starter)</p>}
              </div>
            </div>
          )}

          {/* Bundle tier progress */}
          <div className="grid grid-cols-5 gap-1">
            {BUNDLE_TIERS.map(b => {
              const active = territories.length >= b.min && territories.length <= b.max;
              const discount = parseFloat(pricing?.[b.discountKey] || 0);
              return (
                <div key={b.name} className={`rounded-lg p-2 text-center text-xs transition-all ${active ? "bg-[#1A3226] text-white" : "bg-[#1A3226]/5 text-[#1A3226]/50"}`}>
                  <div className="font-bold">{b.name}</div>
                  <div>{b.min}{b.max === Infinity ? "+" : `–${b.max}`}</div>
                  <div className="font-medium">{discount}% off</div>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search available territories…"
              className="w-full h-10 border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#1A3226]/10 rounded-xl shadow-lg mt-1 overflow-hidden">
                {searchResults.map(r => (
                  <button key={r.id} onClick={() => addTerritory(r)}
                    className="w-full text-left px-4 py-3 hover:bg-[#1A3226]/5 transition-colors border-b last:border-0">
                    <p className="text-sm font-medium text-[#1A3226]">{r.city_town}</p>
                    <p className="text-xs text-[#1A3226]/50">{stateMap[r.state_id]?.code} · {r.seats_total || 1} seat{(r.seats_total || 1) > 1 ? "s" : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Territory list */}
          {territories.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1A3226]/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <Grid3X3 className="w-4 h-4 text-[#1A3226]/40" />
                <div>
                  <p className="text-sm font-medium text-[#1A3226]">{t.city_town}</p>
                  <p className="text-xs text-[#1A3226]/50">{stateMap[t.state_id]?.code} · ${parseFloat(pricing?.starter_monthly_price || 0).toFixed(2)}/mo (Starter)</p>
                </div>
              </div>
              <button onClick={() => remove(t.id)} className="text-[#1A3226]/30 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {territories.length === 0 && (
            <p className="text-sm text-[#1A3226]/40 text-center py-6">Search and add territories to build your bundle.</p>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => navigate("/claim")}>← Back</Button>
            <Button onClick={() => setStep(1)} disabled={territories.length === 0} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Continue →</Button>
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
          priceOverride={(tierKey, base) => ({
            base: territories.length * base,
            discounted: territories.length * base * (1 - (bundle?.discount || 0) / 100),
          })}
        />
      )}
      {step === 2 && <BrokerageInfoStep data={brokerage} onChange={setBrokerage} tier={tier} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <TeamMembersStep members={members} onChange={setMembers} ownerEmail={user?.email} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <PaymentStep pricing={pricing} summary={buildSummary()} onSuccess={handlePaymentSuccess} onBack={() => setStep(3)} />}
    </div>
  );
}