import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, Sparkles, Users, MapPin, Crown } from "lucide-react";

const TABS = [
  { key: "single", label: "Single Territory", icon: MapPin },
  { key: "pool", label: "Population Pool", icon: Users, badge: "New" },
  { key: "bundle", label: "Town Bundle", icon: Sparkles },
  { key: "buyout", label: "Full City Buyout", icon: Crown },
];

const BUNDLE_TIERS = [
  { name: "Duo", range: "2 towns", key: "duo" },
  { name: "Trio", range: "3–4 towns", key: "trio" },
  { name: "Regional", range: "5–9 towns", key: "regional" },
  { name: "District", range: "10–19 towns", key: "district" },
  { name: "Master", range: "20+ towns", key: "master" },
  { name: "County Bundle", range: "Whole county", key: "county" },
];

const BUYOUT_TIERS = [
  { label: "2-seat city", key: "buyout_2seat_discount" },
  { label: "3–4 seat city", key: "buyout_3_4seat_discount" },
  { label: "5–9 seat city", key: "buyout_5_9seat_discount" },
  { label: "10+ seat city", key: "buyout_10plus_seat_discount" },
];

function TierCard({ name, price, cap, features, highlight }) {
  return (
    <div className={`rounded-2xl p-6 flex flex-col gap-4 border-2 transition-all ${highlight ? 'bg-[#1A3226] text-white border-[#1A3226]' : 'bg-white text-[#1A3226] border-[#1A3226]/10 hover:border-[#B8982F]/40'}`}>
      {highlight && <span className="text-[10px] uppercase tracking-wider bg-[#B8982F] text-[#1A3226] font-bold px-3 py-0.5 rounded-full self-start">Most Popular</span>}
      <p className={`font-bold text-lg ${highlight ? 'text-white' : 'text-[#1A3226]'}`}>{name}</p>
      <p className={`text-3xl font-bold ${highlight ? 'text-white' : 'text-[#1A3226]'}`}>
        ${price}<span className={`text-sm font-normal ${highlight ? 'text-white/50' : 'text-[#1A3226]/40'}`}>/mo</span>
      </p>
      <ul className="space-y-2 flex-1">
        {features.map(f => (
          <li key={f} className={`flex items-start gap-2 text-sm ${highlight ? 'text-white/80' : 'text-[#1A3226]/70'}`}>
            <Check className="w-4 h-4 text-[#B8982F] flex-shrink-0 mt-0.5" />{f}
          </li>
        ))}
      </ul>
      <Link to="/territories" className={`text-center text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${highlight ? 'bg-[#B8982F] text-[#1A3226] hover:bg-[#B8982F]/90' : 'bg-[#1A3226] text-white hover:bg-[#1A3226]/90'}`}>
        Claim Territory
      </Link>
    </div>
  );
}

function PoolEstimator({ pricing }) {
  const [pop, setPop] = useState(36000);
  const [tier, setTier] = useState("pro");
  const bucketSize = parseInt(pricing?.territory_seat_size || 50000);
  const tierPrice = parseFloat(pricing?.[`${tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing?.[`${tier}_analyses_cap`] || 0);
  const buckets = Math.max(1, Math.ceil(pop / bucketSize));
  const monthly = buckets * tierPrice;
  const analyses = buckets * tierCap;

  return (
    <div className="bg-[#1A3226]/5 rounded-2xl p-6 space-y-4">
      <p className="font-semibold text-[#1A3226] text-sm">Pool Estimator</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-[#1A3226]/50 font-medium mb-1 block">Total population</label>
          <div className="flex items-center gap-3">
            <input type="range" min={1000} max={500000} step={1000} value={pop} onChange={e => setPop(+e.target.value)}
              className="flex-1 accent-[#B8982F]" />
            <input type="number" min={1} max={500000} value={pop} onChange={e => setPop(Math.max(1, +e.target.value))}
              className="w-28 text-right text-sm border border-[#1A3226]/10 rounded-lg px-2 py-1 bg-white" />
          </div>
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 font-medium mb-1 block">Tier</label>
          <div className="flex gap-2">
            {['starter', 'pro', 'team'].map(t => (
              <button key={t} onClick={() => setTier(t)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg capitalize transition-all ${tier === t ? 'bg-[#1A3226] text-white' : 'bg-white border border-[#1A3226]/10 text-[#1A3226]/60 hover:border-[#1A3226]/30'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[#1A3226]/10 p-4 grid grid-cols-3 gap-3 text-center">
        <div><p className="text-xl font-bold text-[#1A3226]">{buckets}</p><p className="text-xs text-[#1A3226]/50">Buckets</p></div>
        <div><p className="text-xl font-bold text-[#1A3226]">${monthly.toFixed(0)}/mo</p><p className="text-xs text-[#1A3226]/50">Monthly</p></div>
        <div><p className="text-xl font-bold text-[#1A3226]">{analyses}</p><p className="text-xs text-[#1A3226]/50">Analyses/mo</p></div>
      </div>
      <Link to="/claim?type=pool" className="flex items-center justify-center gap-2 w-full bg-[#1A3226] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1A3226]/90 transition-colors">
        Build Your Pool <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function BundleEstimator({ pricing }) {
  const [count, setCount] = useState(3);
  const [tier, setTier] = useState("pro");
  const tierPrice = parseFloat(pricing?.[`${tier}_monthly_price`] || 0);

  function getDiscount(n) {
    if (n >= 20) return parseFloat(pricing?.bundle_master_discount || 0);
    if (n >= 10) return parseFloat(pricing?.bundle_district_discount || 0);
    if (n >= 5) return parseFloat(pricing?.bundle_regional_discount || 0);
    if (n >= 3) return parseFloat(pricing?.bundle_trio_discount || 0);
    if (n >= 2) return parseFloat(pricing?.bundle_duo_discount || 0);
    return 0;
  }
  function getBundleName(n) {
    if (n >= 20) return "Master";
    if (n >= 10) return "District";
    if (n >= 5) return "Regional";
    if (n >= 3) return "Trio";
    if (n >= 2) return "Duo";
    return "Single";
  }

  const discount = getDiscount(count);
  const base = count * tierPrice;
  const discounted = base * (1 - discount / 100);
  const saved = base - discounted;

  return (
    <div className="bg-[#1A3226]/5 rounded-2xl p-6 space-y-4">
      <p className="font-semibold text-[#1A3226] text-sm">Bundle Estimator</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-[#1A3226]/50 font-medium mb-1 block">Number of territories: {count}</label>
          <input type="range" min={1} max={30} value={count} onChange={e => setCount(+e.target.value)}
            className="w-full accent-[#B8982F]" />
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 font-medium mb-1 block">Tier</label>
          <div className="flex gap-2">
            {['starter', 'pro', 'team'].map(t => (
              <button key={t} onClick={() => setTier(t)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg capitalize transition-all ${tier === t ? 'bg-[#1A3226] text-white' : 'bg-white border border-[#1A3226]/10 text-[#1A3226]/60 hover:border-[#1A3226]/30'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[#1A3226]/10 p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-[#1A3226]/50">Bundle tier</span><span className="font-semibold text-[#1A3226]">{getBundleName(count)} ({discount}% off)</span></div>
        <div className="flex justify-between"><span className="text-[#1A3226]/50">Without bundle</span><span className="text-[#1A3226]/60 line-through">${base.toFixed(0)}/mo</span></div>
        <div className="flex justify-between"><span className="text-[#1A3226]/50">With bundle</span><span className="font-bold text-[#1A3226]">${discounted.toFixed(0)}/mo</span></div>
        {saved > 0 && <div className="flex justify-between pt-1 border-t border-[#B8982F]/20"><span className="text-[#B8982F] font-semibold">You save</span><span className="text-[#B8982F] font-bold">${saved.toFixed(0)}/mo</span></div>}
      </div>
      <Link to="/claim?type=bundle" className="flex items-center justify-center gap-2 w-full bg-[#1A3226] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1A3226]/90 transition-colors">
        Explore Bundles <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default function PricingSection({ pricing }) {
  const [activeTab, setActiveTab] = useState("single");
  const s = parseFloat(pricing?.starter_monthly_price || 0);
  const p = parseFloat(pricing?.pro_monthly_price || 0);
  const t = parseFloat(pricing?.team_monthly_price || 0);
  const sCap = parseInt(pricing?.starter_analyses_cap || 0);
  const pCap = parseInt(pricing?.pro_analyses_cap || 0);
  const tCap = parseInt(pricing?.team_analyses_cap || 0);
  const bucketSize = parseInt(pricing?.territory_seat_size || 50000);
  const proPrice = parseFloat(pricing?.pro_monthly_price || 0);

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-10">
        <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Pricing</p>
        <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Priced for Your Market, Whatever Its Size
        </h2>
        <p className="text-sm text-[#1A3226]/60 mt-3 max-w-lg mx-auto">
          Choose the model that fits your footprint — from a single town to a full county.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all relative ${activeTab === tab.key ? 'bg-[#1A3226] text-white' : 'bg-white border border-[#1A3226]/10 text-[#1A3226]/60 hover:border-[#1A3226]/30 hover:text-[#1A3226]'}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.badge && <span className="ml-1 text-[9px] uppercase font-bold bg-[#B8982F] text-[#1A3226] px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Single Territory */}
      {activeTab === "single" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-[#1A3226]/60">One town or city. One seat.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <TierCard name="Starter" price={s.toFixed(0)} cap={sCap} features={[
              `${sCap} analyses/month`,
              'CMA + Buyer Intelligence',
              'Buyer rep, listing rep & dual rep',
              'PDF & PPTX exports',
              'Google Drive sync',
              '1 user',
            ]} />
            <TierCard name="Pro" price={p.toFixed(0)} cap={pCap} features={[
              `${pCap} analyses/month`,
              'All analysis types',
              'All client relationship types',
              'Archetype & migration analysis',
              'Ensemble AI — 5 models in parallel',
              'PDF & PPTX exports',
              'Google Drive sync',
              '1 agent + 1 assistant',
            ]} highlight />
            <TierCard name="Team" price={t.toFixed(0)} cap={tCap} features={[
              `${tCap} analyses/month`,
              'All analysis types',
              'Archetype & migration analysis',
              'Ensemble AI — 5 models in parallel',
              'White-label branding',
              'PDF & PPTX exports',
              'Google Drive sync',
              '4 agents + 1 team lead + 2 assistants',
              'Add-on seats available',
            ]} />
            <TierCard name="Broker" price="199" cap={150} features={[
              '150 analyses/month',
              'Up to 2 teams',
              'Up to 10 agents',
              'Up to 5 assistants',
              'All analysis types',
              'Archetype & migration analysis',
              'Ensemble AI — 5 models in parallel',
              'White-label branding',
              'PDF & PPTX + Drive sync',
            ]} />
          </div>
        </div>
      )}

      {/* Pool */}
      {activeTab === "pool" && (
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#1A3226]">Small Towns? Cover the Region.</h3>
            <p className="text-sm text-[#1A3226]/70 leading-relaxed">
              Don't pay per town. Pay per <strong>{bucketSize.toLocaleString()} residents</strong> — and fill each bucket with as many small towns as you want.
            </p>
            <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-5 space-y-3">
              <p className="text-xs font-bold text-[#1A3226]/40 uppercase tracking-wider">Example: 8 Small Vermont Towns</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center text-[#1A3226]/60">
                  <span>Without pool: 8 towns × ${proPrice.toFixed(0)}</span>
                  <span className="font-semibold line-through text-red-500">${(8 * proPrice).toFixed(0)}/mo</span>
                </div>
                <div className="flex justify-between items-center text-[#1A3226]">
                  <span>With pool: ~36,000 residents = 1 bucket</span>
                  <span className="font-bold text-emerald-600">${proPrice.toFixed(0)}/mo</span>
                </div>
                <div className="pt-2 border-t border-[#B8982F]/20 flex justify-between text-[#B8982F] font-bold">
                  <span>You save</span>
                  <span>${(7 * proPrice).toFixed(0)}/mo</span>
                </div>
              </div>
            </div>
          </div>
          <PoolEstimator pricing={pricing} />
        </div>
      )}

      {/* Bundle */}
      {activeTab === "bundle" && (
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#1A3226]">Multiple territories, one subscription.</h3>
            <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A3226]/[0.04] border-b border-[#1A3226]/8">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wide">Bundle</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wide">Coverage</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wide">Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {BUNDLE_TIERS.map((bt, i) => (
                    <tr key={bt.key} className={`border-b border-[#1A3226]/5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#1A3226]/[0.01]'}`}>
                      <td className="px-5 py-3 font-semibold text-[#1A3226]">{bt.name}</td>
                      <td className="px-5 py-3 text-[#1A3226]/60">{bt.range}</td>
                      <td className="px-5 py-3 text-right font-bold text-[#B8982F]">
                        {parseFloat(pricing?.[`bundle_${bt.key}_discount`] || 0)}% off
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <BundleEstimator pricing={pricing} />
        </div>
      )}

      {/* Buyout */}
      {activeTab === "buyout" && (
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-[#1A3226]">Own every seat in a city. Zero competition.</h3>
            <p className="text-sm text-[#1A3226]/70 leading-relaxed">
              In cities with multiple PropPrompt seats, buy them all and lock out every competitor permanently.
            </p>
            <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A3226]/[0.04] border-b border-[#1A3226]/8">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wide">City Size</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wide">Buyout Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {BUYOUT_TIERS.map((bt, i) => (
                    <tr key={bt.key} className={`border-b border-[#1A3226]/5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#1A3226]/[0.01]'}`}>
                      <td className="px-5 py-3 font-semibold text-[#1A3226]">{bt.label}</td>
                      <td className="px-5 py-3 text-right font-bold text-[#B8982F]">
                        {parseFloat(pricing?.[bt.key] || 0)}% off
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-2xl bg-[#1A3226] text-white p-5 space-y-2">
              <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Example: Manchester, NH — 3 seats</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Standard: 3 × ${proPrice.toFixed(0)}</span>
                  <span className="line-through">${(3 * proPrice).toFixed(0)}/mo</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Full Buyout</span>
                  <span>${(3 * proPrice * (1 - parseFloat(pricing?.buyout_3_4seat_discount || 25) / 100)).toFixed(0)}/mo</span>
                </div>
              </div>
              <p className="text-xs text-[#B8982F] font-semibold mt-2">The only PropPrompt partner in the city.</p>
            </div>
            <Link to="/territories?filter=multi_seat" className="flex items-center gap-2 text-sm font-semibold text-[#1A3226] hover:text-[#B8982F] transition-colors">
              See Multi-Seat Cities <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="rounded-2xl bg-[#B8982F]/5 border border-[#B8982F]/20 p-6 space-y-4">
            <p className="font-semibold text-[#1A3226]">Why buy out a city?</p>
            <ul className="space-y-3">
              {[
                "No competitor can get a PropPrompt seat in your city",
                "Consolidate multiple seats at a steep discount",
                "First-right-of-refusal if new seats open",
                "Full white-label branding for the market",
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#1A3226]/70">
                  <Check className="w-4 h-4 text-[#B8982F] flex-shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}