import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClaimsStatsRow from "@/components/admin/claims/ClaimsStatsRow";
import ClaimsTable from "@/components/admin/claims/ClaimsTable";
import ApproveModal from "@/components/admin/claims/ApproveModal";
import RejectModal from "@/components/admin/claims/RejectModal";
import { useToast } from "@/components/ui/use-toast";

function getClaimType(c) {
  if (c.pool_id) return 'pool';
  if (c.bundle_id) return 'bundle';
  if (c.type_requested === 'county_bundle' || c.type_requested === 'full_buyout') return 'buyout';
  return 'single';
}

export default function ClaimsAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pricing, loading: pricingLoading } = usePricing();

  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const loadClaims = useCallback(async () => {
    try {
      const [allClaims, territories, states, pools, bundles, buyouts, released] = await Promise.all([
        base44.entities.TerritoryClaimRequest.list('-created_date', 200),
        base44.entities.Territory.list('-updated_date', 500),
        base44.entities.State.list(),
        base44.entities.PopulationPool.list(),
        base44.entities.TerritoryBundle.list(),
        base44.entities.FullBuyoutSubscription.list(),
        base44.entities.ReleasedTerritory.list('-created_date', 200),
      ]);

      const stateMap = Object.fromEntries(states.map(s => [s.id, s]));
      const territoryMap = Object.fromEntries(territories.map(t => [t.id, t]));
      const tierPrices = {
        starter: parseFloat(pricing?.starter_monthly_price || 0),
        pro: parseFloat(pricing?.pro_monthly_price || 0),
        team: parseFloat(pricing?.team_monthly_price || 0),
      };

      const enriched = allClaims.map(c => {
        const type = getClaimType(c);
        let summary = '—';
        let monthlyValue = null;

        if (type === 'single' && c.territory_id) {
          const t = territoryMap[c.territory_id];
          const st = t ? stateMap[t.state_id] : null;
          summary = t ? `${t.city_town}, ${st?.code}` : c.territory_id;
          monthlyValue = tierPrices[c.tier_requested]?.toFixed(2);
        } else if (type === 'pool' && c.pool_id) {
          const pool = pools.find(p => p.id === c.pool_id);
          if (pool) {
            summary = `${pool.territory_ids?.length || 0} towns — ${(pool.combined_population || 0).toLocaleString()} residents — ${pool.buckets_used || 0} buckets`;
            monthlyValue = pool.monthly_price?.toFixed(2);
          }
        } else if (type === 'bundle' && c.bundle_id) {
          const bundle = bundles.find(b => b.id === c.bundle_id);
          if (bundle) {
            summary = `${bundle.territory_count || 0} territories — ${bundle.bundle_name} tier`;
            monthlyValue = bundle.discounted_price?.toFixed(2);
          }
        } else if (type === 'buyout' && c.territory_id) {
          const t = territoryMap[c.territory_id];
          const st = t ? stateMap[t.state_id] : null;
          const bo = buyouts.find(b => b.territory_id === c.territory_id && b.user_id === c.user_id);
          summary = t ? `${t.city_town}, ${st?.code} — ${t.seats_total || 1} seats — Full Buyout` : '—';
          monthlyValue = bo?.monthly_price?.toFixed(2);
        }

        // Right of first refusal check
        const releasedRecord = type === 'single' && c.territory_id
          ? released.find(r => r.territory_id === c.territory_id && new Date(r.right_of_refusal_expires_at) > new Date())
          : null;

        return { ...c, _type: type, _territorySummary: summary, _monthlyValue: monthlyValue, _releasedRecord: releasedRecord || null };
      });

      setClaims(enriched);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('[ClaimsAdmin] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [pricing]);

  useEffect(() => {
    base44.auth.me().then(me => {
      if (me?.role !== 'admin' && me?.role !== 'platform_owner') navigate('/Dashboard');
      else setUser(me);
    });
  }, []);

  useEffect(() => {
    if (!pricingLoading) loadClaims();
  }, [pricingLoading, loadClaims]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => { if (!pricingLoading) loadClaims(); }, 60000);
    return () => clearInterval(interval);
  }, [pricingLoading, loadClaims]);

  const handleApprove = async (claimId) => {
    try {
      const res = await base44.functions.invoke('approveClaim', { claim_id: claimId, admin_user_id: user?.id });
      if (res.data?.success) {
        toast({ title: "Claim approved", description: "Subscription activated and email sent." });
        await loadClaims();
      } else {
        toast({ title: "Error", description: res.data?.error || "Approval failed", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async (claimId, reason) => {
    try {
      const res = await base44.functions.invoke('rejectClaim', { claim_id: claimId, reason });
      if (res.data?.success) {
        toast({ title: "Claim rejected", description: "Territories released and email sent." });
        await loadClaims();
      } else {
        toast({ title: "Error", description: res.data?.error || "Rejection failed", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading || pricingLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Territory Claim Queue</h1>
          <p className="text-sm text-[#1A3226]/50 mt-0.5">
            Auto-approve window: {pricing?.auto_approve_hours || 48}h · Re-claim block: {pricing?.rejection_recliam_days || 30} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-[#1A3226]/40">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={loadClaims} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <ClaimsStatsRow claims={claims} />

      {/* Table */}
      <ClaimsTable
        claims={claims}
        pricing={pricing}
        onApprove={setApproveTarget}
        onReject={setRejectTarget}
      />

      {/* Modals */}
      <ApproveModal
        claim={approveTarget}
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
      />
      <RejectModal
        claim={rejectTarget}
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  );
}