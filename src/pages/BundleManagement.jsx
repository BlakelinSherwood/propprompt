import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { Loader2, Grid3X3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import BundleTerritoriesTab from "@/components/account/BundleTerritoriesTab";
import BundleTeamTab from "@/components/account/BundleTeamTab";
import BundleUsageTab from "@/components/account/BundleUsageTab";

const BUNDLE_COLORS = {
  duo: 'bg-emerald-100 text-emerald-700',
  trio: 'bg-blue-100 text-blue-700',
  regional: 'bg-indigo-100 text-indigo-700',
  district: 'bg-purple-100 text-purple-700',
  master: 'bg-amber-100 text-amber-700',
  county: 'bg-[#B8982F]/20 text-[#B8982F]',
};

export default function BundleManagement() {
  const { bundle_id } = useParams();
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();

  const [user, setUser] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [members, setMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [stateMap, setStateMap] = useState({});
  const [countyMap, setCountyMap] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [me, states, counties] = await Promise.all([
      base44.auth.me(),
      base44.entities.State.list(),
      base44.entities.County.list(),
    ]);
    setUser(me);
    const sm = Object.fromEntries(states.map(s => [s.id, s]));
    const cm = Object.fromEntries(counties.map(c => [c.id, c]));
    setStateMap(sm);
    setCountyMap(cm);

    const [bundleRows, memberRows, teamRows] = await Promise.all([
      base44.entities.TerritoryBundle.filter({ id: bundle_id }),
      base44.entities.TerritoryBundleMember.filter({ bundle_id }),
      base44.entities.BundleUserMember.filter({ bundle_id }),
    ]);

    const b = bundleRows[0];
    if (!b) { navigate('/Dashboard'); return; }

    // Verify ownership
    if (b.owner_user_id !== me.id && me.role !== 'platform_owner') {
      navigate('/Dashboard'); return;
    }
    setBundle(b);
    setTeamMembers(teamRows);

    // Enrich members with territory data
    const enriched = await Promise.all(memberRows.map(async m => {
      const rows = await base44.entities.Territory.filter({ id: m.territory_id });
      return { ...m, _territory: rows[0] };
    }));
    setMembers(enriched);
    setLoading(false);
  }, [bundle_id]);

  useEffect(() => { if (!pricingLoading) load(); }, [pricingLoading, load]);

  if (loading || pricingLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" />
    </div>
  );

  const tierPrice = parseFloat(pricing?.[`${bundle.tier}_monthly_price`] || 0);
  const discountedPrice = bundle.discounted_price || 0;
  const discountPct = bundle.discount_pct || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1A3226]/5 flex items-center justify-center">
            <Grid3X3 className="w-6 h-6 text-[#1A3226]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[#1A3226] capitalize">{bundle.bundle_name} Bundle</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${BUNDLE_COLORS[bundle.bundle_name] || 'bg-gray-100 text-gray-600'}`}>
                {bundle.bundle_name}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1A3226]/10 text-[#1A3226] capitalize">
                {bundle.tier}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-[#1A3226]/60">
              <span>Territories: <strong className="text-[#1A3226]">{bundle.territory_count || members.length}</strong></span>
              <span>Discount: <strong className="text-[#1A3226]">{discountPct}%</strong></span>
              <span>Monthly: <strong className="text-[#1A3226]">${discountedPrice.toFixed(2)}</strong></span>
              <span>Analyses cap: <strong className="text-[#1A3226]">{bundle.analyses_cap || 0}/mo</strong></span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="territories">
        <TabsList className="bg-[#1A3226]/5">
          <TabsTrigger value="territories">Territories</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="territories" className="mt-4">
          <BundleTerritoriesTab
            bundle={bundle} members={members} stateMap={stateMap} countyMap={countyMap}
            pricing={pricing} onRefresh={load}
          />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <BundleTeamTab bundle={bundle} teamMembers={teamMembers} currentUser={user} onRefresh={load} />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <BundleUsageTab bundle={bundle} teamMembers={teamMembers} user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}