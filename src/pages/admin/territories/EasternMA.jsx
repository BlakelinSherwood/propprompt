import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Map, BarChart3 } from "lucide-react";
import SubStatsRow from "@/components/admin/sublicense/SubStatsRow";
import TerritoryMapbox from "@/components/admin/sublicense/TerritoryMapbox";
import TownsTable from "@/components/admin/sublicense/TownsTable";
import SublicenseModal from "@/components/admin/sublicense/SublicenseModal";
import AdjustRevShareModal from "@/components/admin/sublicense/AdjustRevShareModal";
import ReleaseModal from "@/components/admin/sublicense/ReleaseModal";
import RevenueShareTab from "@/components/admin/sublicense/RevenueShareTab";

const TABS = [
  { key: "towns", label: "Towns", icon: Map },
  { key: "revenue", label: "Revenue Share", icon: BarChart3 },
];

export default function EasternMA() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pricing, loading: pricingLoading } = usePricing();

  const [user, setUser] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [counties, setCounties] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("towns");

  // Modals
  const [sublicenseTown, setSublicenseTown] = useState(null);
  const [releaseTown, setReleaseTown] = useState(null);
  const [adjustData, setAdjustData] = useState(null); // { town, subscription }
  const [revokePending, setRevokePending] = useState(null); // { town, subscription }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [terrs, cntys, subs, led] = await Promise.all([
        base44.entities.Territory.list("-updated_date", 400),
        base44.entities.County.list(),
        base44.entities.TerritorySubscription.filter({ status: "active" }),
        base44.entities.RevenueShareLedger.list("-created_date", 500),
      ]);
      setTerritories(terrs.filter(t => ["reserved", "sublicensed", "available"].includes(t.status)));
      setCounties(cntys);
      setSubscriptions(subs.filter(s => s.sublicensor_id));
      setLedger(led);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.me().then(me => {
      if (me?.role !== "admin" && me?.role !== "platform_owner") navigate("/Dashboard");
      else setUser(me);
    });
  }, []);

  useEffect(() => { if (!pricingLoading) load(); }, [pricingLoading]);

  // Current month ledger total
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ledgerTotal = ledger
    .filter(r => r.period_start?.startsWith(currentMonthPrefix))
    .reduce((s, r) => s + (r.share_amount || 0), 0);

  // Release handler
  const handleRelease = async (town, reason) => {
    try {
      const refusalDays = pricing?.founder_refusal_days ?? 7;
      const expires = new Date();
      expires.setDate(expires.getDate() + refusalDays);

      await Promise.all([
        base44.entities.Territory.update(town.id, { status: "available" }),
        base44.entities.ReleasedTerritory.create({
          territory_id: town.id,
          released_by: user.email,
          release_reason: reason || "",
          right_of_refusal_expires_at: expires.toISOString(),
        }),
      ]);
      toast({ title: "Territory released", description: `${town.city_town} returned to available. Right of refusal: ${refusalDays} days.` });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Revoke handler
  const handleRevoke = async (town, sub) => {
    if (!confirm(`Revoke sublicense for ${town.city_town}? This will cancel the Stripe subscription and return the territory to reserved.`)) return;
    try {
      const res = await base44.functions.invoke("revokeSublicense", {
        subscription_id: sub.id,
        territory_id: town.id,
      });
      if (res.data?.success) {
        toast({ title: "Sublicense revoked", description: `${town.city_town} returned to reserved.` });
        await load();
      } else {
        toast({ title: "Error", description: res.data?.error, variant: "destructive" });
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Eastern MA — Sublicensing Panel</h1>
          <p className="text-sm text-[#1A3226]/50 mt-0.5">
            Right of refusal window: {pricing?.founder_refusal_days ?? 7} days ·
            Rev share range: {pricing?.sublicense_min_share_pct ?? 10}%–{pricing?.sublicense_max_share_pct ?? 40}%
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <SubStatsRow territories={territories} ledgerTotal={ledgerTotal} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1A3226]/10">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-[#1A3226] text-[#1A3226]"
                : "border-transparent text-[#1A3226]/50 hover:text-[#1A3226]/70"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "towns" && (
        <div className="space-y-6">
          {/* Map */}
          <div className="relative">
            <TerritoryMapbox
              territories={territories}
              onTownClick={(t) => {
                if (t.status === "reserved") setSublicenseTown(t);
              }}
            />
          </div>

          {/* Table */}
          <TownsTable
            territories={territories}
            counties={counties}
            subscriptions={subscriptions}
            onSublicense={setSublicenseTown}
            onRelease={setReleaseTown}
            onAdjust={(t, sub) => setAdjustData({ town: t, subscription: sub })}
            onRevoke={handleRevoke}
          />
        </div>
      )}

      {activeTab === "revenue" && (
        <RevenueShareTab
          ledger={ledger}
          territories={territories}
          subscriptions={subscriptions}
        />
      )}

      {/* Modals */}
      <SublicenseModal
        town={sublicenseTown}
        open={!!sublicenseTown}
        onClose={() => setSublicenseTown(null)}
        onCreated={load}
        pricing={pricing}
      />
      <ReleaseModal
        town={releaseTown}
        open={!!releaseTown}
        onClose={() => setReleaseTown(null)}
        onConfirm={handleRelease}
        refusalDays={pricing?.founder_refusal_days ?? 7}
      />
      <AdjustRevShareModal
        town={adjustData?.town}
        subscription={adjustData?.subscription}
        open={!!adjustData}
        onClose={() => setAdjustData(null)}
        onSaved={load}
        pricing={pricing}
      />
    </div>
  );
}