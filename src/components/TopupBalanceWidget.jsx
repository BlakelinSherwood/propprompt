import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShoppingCart, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import moment from "moment";

export default function TopupBalanceWidget({ user }) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const now = new Date().toISOString();

    // Load user's subscriptions to find associated packs
    async function load() {
      const [singles, pools, bundles] = await Promise.all([
        base44.entities.TerritorySubscription.filter({ user_id: user.id, status: 'active' }),
        base44.entities.PopulationPool.filter({ owner_user_id: user.id, status: 'active' }),
        base44.entities.TerritoryBundle.filter({ owner_user_id: user.id, status: 'active' }),
      ]);

      const subIds = singles.map(s => s.id);
      const bundleIds = bundles.map(b => b.id);
      const poolIds = pools.map(p => p.id);

      const allPacks = await base44.entities.TopupPack.list('expires_at', 50);
      const active = allPacks.filter(p =>
        p.analyses_remaining > 0 &&
        p.expires_at > now &&
        (
          (p.subscription_id && subIds.includes(p.subscription_id)) ||
          (p.bundle_id && bundleIds.includes(p.bundle_id)) ||
          (p.pool_id && poolIds.includes(p.pool_id)) ||
          (!p.subscription_id && !p.bundle_id && !p.pool_id)
        )
      );
      setPacks(active);
      setLoading(false);
    }

    load().catch(console.error);
  }, [user?.id]);

  if (loading || packs.length === 0) return null;

  const total = packs.reduce((s, p) => s + (p.analyses_remaining || 0), 0);
  const earliest = packs[0]; // sorted by expires_at ascending

  return (
    <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[#B8982F]" />
          <span className="text-sm font-semibold text-[#1A3226]">Top-up Analyses</span>
        </div>
        <Link to="/account/topup" className="text-xs text-[#B8982F] hover:underline">Buy more</Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-[#1A3226]">{total}</p>
          <p className="text-xs text-[#1A3226]/50">remaining across {packs.length} pack{packs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right text-xs text-[#1A3226]/50 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>Earliest expiry: {moment(earliest.expires_at).format('MMM D')}</span>
        </div>
      </div>

      {packs.length > 1 && (
        <div className="space-y-1 border-t border-[#B8982F]/20 pt-2">
          {packs.map(p => (
            <div key={p.id} className="flex justify-between text-xs text-[#1A3226]/60">
              <span>{p.analyses_remaining} analyses</span>
              <span>expires {moment(p.expires_at).fromNow()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}