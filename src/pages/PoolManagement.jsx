import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { Loader2, Layers } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PoolTownsTab from "@/components/account/PoolTownsTab";
import PoolUsageTab from "@/components/account/PoolUsageTab";

export default function PoolManagement() {
  const { pool_id } = useParams();
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();

  const [user, setUser] = useState(null);
  const [pool, setPool] = useState(null);
  const [members, setMembers] = useState([]);
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
    setStateMap(Object.fromEntries(states.map(s => [s.id, s])));
    setCountyMap(Object.fromEntries(counties.map(c => [c.id, c])));

    const [poolRows, memberRows] = await Promise.all([
      base44.entities.PopulationPool.filter({ id: pool_id }),
      base44.entities.PopulationPoolMember.filter({ pool_id }),
    ]);

    const p = poolRows[0];
    if (!p) { navigate('/Dashboard'); return; }
    if (p.owner_user_id !== me.id && me.role !== 'platform_owner') {
      navigate('/Dashboard'); return;
    }
    setPool(p);

    // Enrich members with territory data
    const enriched = await Promise.all(memberRows.map(async m => {
      const rows = await base44.entities.Territory.filter({ id: m.territory_id });
      return { ...m, _territory: rows[0] };
    }));
    setMembers(enriched);
    setLoading(false);
  }, [pool_id]);

  useEffect(() => { if (!pricingLoading) load(); }, [pricingLoading, load]);

  if (loading || pricingLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" />
    </div>
  );

  const bucketSize = parseInt(pricing?.territory_seat_size || 50000);
  const tierPrice = parseFloat(pricing?.[`${pool.tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing?.[`${pool.tier}_analyses_cap`] || 0);
  const buckets = pool.buckets_used || 1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[#1A3226]">Population Pool</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{pool.tier}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
              {[
                { label: 'Towns', value: members.length },
                { label: 'Population', value: (pool.combined_population || 0).toLocaleString() },
                { label: 'Buckets', value: `${buckets} × ${bucketSize.toLocaleString()}` },
                { label: 'Monthly', value: `$${(pool.monthly_price || 0).toFixed(2)}` },
                { label: 'Analyses/mo', value: pool.analyses_cap || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-[#1A3226]/[0.03] p-3 text-center">
                  <p className="text-base font-bold text-[#1A3226]">{value}</p>
                  <p className="text-xs text-[#1A3226]/50">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#1A3226]/40 mt-2">
              {buckets} buckets × ${tierPrice.toFixed(2)}/mo = ${(pool.monthly_price || 0).toFixed(2)}/mo · {buckets * tierCap} analyses/mo
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="towns">
        <TabsList className="bg-[#1A3226]/5">
          <TabsTrigger value="towns">Towns ({members.length})</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="towns" className="mt-4">
          <PoolTownsTab
            pool={pool} members={members} stateMap={stateMap} countyMap={countyMap}
            pricing={pricing} onRefresh={load}
          />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <PoolUsageTab pool={pool} user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}