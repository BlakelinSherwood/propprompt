import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";

export default function ApproveModal({ claim, open, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const claimType = claim?.pool_id ? 'pool'
    : claim?.bundle_id ? 'bundle'
    : (claim?.type_requested === 'county_bundle' || claim?.type_requested === 'full_buyout') ? 'buyout'
    : 'single';

  const TYPE_LABELS = { single: 'Single Territory', pool: 'Population Pool', bundle: 'Town Bundle', buyout: 'Full City Buyout' };

  const handle = async () => {
    setLoading(true);
    await onConfirm(claim.id);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1A3226]">Approve Claim</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm space-y-1">
            <p className="font-semibold text-emerald-800">{claim?.brokerage_name}</p>
            <p className="text-emerald-700">{TYPE_LABELS[claimType]} · {claim?.tier_requested} tier</p>
          </div>
          <div className="space-y-2 text-sm text-[#1A3226]/70">
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /><span>Stripe subscription will be created and charged</span></div>
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /><span>Territory status will be set to active</span></div>
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /><span>Approval confirmation email will be sent</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handle} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</> : "Confirm Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}