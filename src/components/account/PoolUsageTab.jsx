import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopupBalanceWidget from "@/components/TopupBalanceWidget";

export default function PoolUsageTab({ pool, user }) {
  const used = pool.analyses_used_this_month || 0;
  const cap = pool.analyses_cap || 0;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;

  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.ceil((nextReset - now) / 86400000);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
        <div className="flex justify-between items-baseline">
          <p className="font-semibold text-[#1A3226]">Monthly Usage</p>
          <p className="text-sm text-[#1A3226]/50">Resets in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-[#1A3226]">{used} used</span>
            <span className="text-[#1A3226]/50">{cap} cap</span>
          </div>
          <div className="w-full h-3 bg-[#1A3226]/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-[#1A3226]'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[#1A3226]/40 mt-1">{cap - used} remaining this month</p>
        </div>
      </div>

      <TopupBalanceWidget user={user} />
      <Button asChild variant="outline" className="gap-2">
        <Link to={`/account/topup?pool_id=${pool.id}`}>
          <ShoppingCart className="w-4 h-4" /> Purchase Top-Up
        </Link>
      </Button>
    </div>
  );
}