import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Shield, MapPin, Users, Grid3X3 } from "lucide-react";

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-[#1A3226]/5 last:border-0">
      <span className="text-[#1A3226]/50 min-w-[140px]">{label}</span>
      <span className="font-medium text-[#1A3226] text-right">{value || "—"}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-[#1A3226]/10 p-4 space-y-0.5">
      <p className="text-xs font-semibold text-[#1A3226]/40 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function ClaimDetail({ claim, pricing }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const claimType = claim.pool_id ? 'pool'
    : claim.bundle_id ? 'bundle'
    : (claim.type_requested === 'county_bundle' || claim.type_requested === 'full_buyout') ? 'buyout'
    : 'single';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = { territory: null, state: null, county: null, pool: null, towns: [], bundle: null, bundleMembers: [], buyout: null };

        if (claimType === 'single' && claim.territory_id) {
          const [ts, states, counties] = await Promise.all([
            base44.entities.Territory.filter({ id: claim.territory_id }),
            base44.entities.State.list(),
            base44.entities.County.list(),
          ]);
          result.territory = ts[0];
          result.state = states.find(s => s.id === ts[0]?.state_id);
          result.county = counties.find(c => c.id === ts[0]?.county_id);
        } else if (claimType === 'pool' && claim.pool_id) {
          const poolRows = await base44.entities.PopulationPool.filter({ id: claim.pool_id });
          result.pool = poolRows[0];
          if (result.pool?.territory_ids?.length) {
            const states = await base44.entities.State.list();
            result.stateMap = Object.fromEntries(states.map(s => [s.id, s]));
            const townsArr = await Promise.all(
              result.pool.territory_ids.map(id => base44.entities.Territory.filter({ id }).then(r => r[0]))
            );
            result.towns = townsArr.filter(Boolean);
          }
        } else if (claimType === 'bundle' && claim.bundle_id) {
          const [bundleRows, states] = await Promise.all([
            base44.entities.TerritoryBundle.filter({ id: claim.bundle_id }),
            base44.entities.State.list(),
          ]);
          result.bundle = bundleRows[0];
          result.stateMap = Object.fromEntries(states.map(s => [s.id, s]));
          if (result.bundle) {
            const members = await base44.entities.TerritoryBundleMember.filter({ bundle_id: result.bundle.id });
            const terrs = await Promise.all(members.map(m => base44.entities.Territory.filter({ id: m.territory_id }).then(r => r[0])));
            result.bundleMembers = terrs.filter(Boolean);
          }
        } else if (claimType === 'buyout' && claim.territory_id) {
          const [ts, states, buyoutRows] = await Promise.all([
            base44.entities.Territory.filter({ id: claim.territory_id }),
            base44.entities.State.list(),
            base44.entities.FullBuyoutSubscription.filter({ territory_id: claim.territory_id, user_id: claim.user_id }),
          ]);
          result.territory = ts[0];
          result.state = states.find(s => s.id === ts[0]?.state_id);
          result.buyout = buyoutRows[0];
        }

        setData(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [claim.id]);

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#1A3226]/40" /></div>;
  if (!data) return null;

  const tier = claim.tier_requested;

  return (
    <div className="p-5 bg-[#1A3226]/[0.015] space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Brokerage Info */}
        <Section title="Brokerage Info">
          <Row label="Brokerage" value={claim.brokerage_name} />
          <Row label="License #" value={claim.brokerage_license} />
          <Row label="Agent Count" value={claim.agent_count} />
          <Row label="Submitted" value={claim.created_date ? new Date(claim.created_date).toLocaleString() : "—"} />
          <Row label="Auto-approves" value={claim.auto_approve_at ? new Date(claim.auto_approve_at).toLocaleString() : "—"} />
        </Section>

        {/* Type-specific detail */}
        {claimType === 'single' && data.territory && (
          <Section title="Territory">
            <Row label="City / Town" value={`${data.territory.city_town}, ${data.state?.code}`} />
            <Row label="County" value={data.county?.name} />
            <Row label="Population" value={data.territory.population?.toLocaleString()} />
            <Row label="Seats Total" value={data.territory.seats_total} />
            <Row label="Seats Claimed" value={data.territory.seats_claimed || 0} />
            <Row label="Tier" value={tier} />
            <Row label="Monthly Price" value={`$${parseFloat(pricing[`${tier}_monthly_price`] || 0).toFixed(2)}`} />
            <Row label="Analyses Cap" value={`${pricing[`${tier}_analyses_cap`] || 0}/mo`} />
          </Section>
        )}

        {claimType === 'pool' && data.pool && (
          <Section title="Pool Details">
            <Row label="Towns" value={data.towns.length} />
            <Row label="Combined Population" value={data.pool.combined_population?.toLocaleString()} />
            <Row label="Buckets Used" value={data.pool.buckets_used} />
            <Row label="Bucket Size" value={parseInt(pricing?.territory_seat_size || 50000).toLocaleString()} />
            <Row label="Monthly Price" value={`$${parseFloat(data.pool.monthly_price || 0).toFixed(2)}`} />
            <Row label="Analyses Cap" value={data.pool.analyses_cap} />
          </Section>
        )}

        {claimType === 'bundle' && data.bundle && (
          <Section title="Bundle Details">
            <Row label="Bundle Tier" value={data.bundle.bundle_name} />
            <Row label="Territories" value={data.bundle.territory_count} />
            <Row label="Discount" value={`${data.bundle.discount_pct}%`} />
            <Row label="Base Price" value={`$${parseFloat(data.bundle.base_price || 0).toFixed(2)}/mo`} />
            <Row label="Discounted Price" value={`$${parseFloat(data.bundle.discounted_price || 0).toFixed(2)}/mo`} />
          </Section>
        )}

        {claimType === 'buyout' && data.territory && (
          <Section title="Buyout Details">
            <Row label="City" value={`${data.territory.city_town}, ${data.state?.code}`} />
            <Row label="Population" value={data.territory.population?.toLocaleString()} />
            <Row label="Total Seats" value={data.territory.seats_total} />
            <Row label="Seats Claimed Now" value={data.territory.seats_claimed || 0} />
            <Row label="Base Price" value={`$${parseFloat(data.buyout?.base_price || 0).toFixed(2)}/mo`} />
            <Row label="Discount" value={`${data.buyout?.discount_pct || 0}%`} />
            <Row label="Final Price" value={`$${parseFloat(data.buyout?.monthly_price || 0).toFixed(2)}/mo`} />
          </Section>
        )}
      </div>

      {/* Pool — town list */}
      {claimType === 'pool' && data.towns.length > 0 && (
        <div className="rounded-xl border border-[#1A3226]/10 p-4">
          <p className="text-xs font-semibold text-[#1A3226]/40 uppercase tracking-wider mb-3">Towns in Pool</p>
          <div className="space-y-1">
            {data.towns.map(t => (
              <div key={t.id} className="flex justify-between text-sm py-1">
                <span className="text-[#1A3226]">{t.city_town} <span className="text-[#1A3226]/40">{data.stateMap?.[t.state_id]?.code}</span></span>
                <span className="text-[#1A3226]/50">{(t.population || 0).toLocaleString()} residents</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bundle — territory list */}
      {claimType === 'bundle' && data.bundleMembers.length > 0 && (
        <div className="rounded-xl border border-[#1A3226]/10 p-4">
          <p className="text-xs font-semibold text-[#1A3226]/40 uppercase tracking-wider mb-3">Territories in Bundle</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.bundleMembers.map(t => (
              <div key={t.id} className="text-sm text-[#1A3226] bg-white rounded-lg px-3 py-2 border border-[#1A3226]/8">
                {t.city_town} <span className="text-[#1A3226]/40">{data.stateMap?.[t.state_id]?.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buyout — exclusive badge preview */}
      {claimType === 'buyout' && data.territory && (
        <div className="rounded-xl border-2 border-[#B8982F]/40 bg-gradient-to-br from-[#1A3226] to-[#1A3226]/80 text-white p-5 text-center space-y-2">
          <Shield className="w-7 h-7 text-[#B8982F] mx-auto" />
          <p className="font-bold text-sm">The Only PropPrompt Partner in {data.territory.city_town}, {data.state?.code}</p>
          <p className="text-xs text-white/50">Badge preview</p>
        </div>
      )}

      {/* Large-population warning for buyout */}
      {claimType === 'buyout' && data.territory?.population > 100000 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-orange-800">High-Population Buyout</p>
            <p className="text-sm text-orange-700 mt-1">
              This gives one subscriber full exclusivity in a <strong>{data.territory.population.toLocaleString()}</strong> resident city. Approve intentionally.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}