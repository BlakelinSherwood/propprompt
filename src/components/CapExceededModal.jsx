import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { TrendingUp, ShoppingCart, RotateCcw } from "lucide-react";
import { usePricing } from "@/components/pricing/usePricing";
import moment from "moment";

export default function CapExceededModal({ open, onClose, quotaInfo }) {
  const { pricing } = usePricing();

  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0);
  const daysUntilReset = Math.ceil((nextReset - now) / (1000 * 60 * 60 * 24));

  const packs = [
    { key: 'starter', analyses: parseInt(pricing?.topup_starter_analyses || 10), price: parseFloat(pricing?.topup_starter_price || 29) },
    { key: 'standard', analyses: parseInt(pricing?.topup_standard_analyses || 25), price: parseFloat(pricing?.topup_standard_price || 59) },
    { key: 'pro', analyses: parseInt(pricing?.topup_pro_analyses || 50), price: parseFloat(pricing?.topup_pro_price || 99) },
    { key: 'bulk', analyses: parseInt(pricing?.topup_bulk_analyses || 100), price: parseFloat(pricing?.topup_bulk_price || 179) },
  ];

  const monthName = now.toLocaleString('default', { month: 'long' });
  const cap = quotaInfo?.cap || 0;
  const tier = quotaInfo?.all_subscriptions?.[0]?.tier;
  const showUpgradeCTA = tier === 'starter' || tier === 'pro';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#1A3226]">Analysis Limit Reached</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
            <p className="text-lg font-bold text-red-700">You've used all {cap} analyses for {monthName}</p>
            <p className="text-sm text-red-600 mt-1 flex items-center justify-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''} · {moment(nextReset).format('MMM 1, YYYY')}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1A3226] mb-3">Add more analyses now</p>
            <div className="grid grid-cols-2 gap-3">
              {packs.map(pack => {
                const perAnalysis = (pack.price / pack.analyses).toFixed(2);
                return (
                  <Link key={pack.key} to={`/account/topup?pack=${pack.key}`} onClick={onClose}>
                    <div className="rounded-xl border-2 border-[#1A3226]/10 hover:border-[#B8982F]/50 hover:bg-[#B8982F]/5 p-4 transition-all cursor-pointer text-center">
                      <p className="text-xl font-bold text-[#1A3226]">{pack.analyses}</p>
                      <p className="text-xs text-[#1A3226]/50">analyses</p>
                      <p className="text-base font-semibold text-[#1A3226] mt-2">${pack.price}</p>
                      <p className="text-xs text-[#1A3226]/40">${perAnalysis}/each</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {showUpgradeCTA && (
            <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-4 flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-[#B8982F] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#1A3226]">Need more every month?</p>
                <p className="text-xs text-[#1A3226]/60 mt-0.5 mb-2">Upgrade your territory tier to get a higher monthly cap.</p>
                <Button size="sm" variant="outline" className="text-[#1A3226] border-[#1A3226]/20" asChild onClick={onClose}>
                  <Link to="/territories">View Tier Options →</Link>
                </Button>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}