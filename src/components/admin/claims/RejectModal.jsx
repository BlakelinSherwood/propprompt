import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function RejectModal({ claim, open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!reason.trim()) { setError("Rejection reason is required"); return; }
    setLoading(true);
    setError("");
    await onConfirm(claim.id, reason.trim());
    setLoading(false);
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1A3226]">Reject Claim</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-[#1A3226]/5 px-4 py-3 text-sm text-[#1A3226]">
            <strong>{claim?.brokerage_name}</strong> — {claim?.tier_requested} tier
          </div>
          <div>
            <label className="text-sm font-medium text-[#1A3226]">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(""); }}
              placeholder="Provide a clear reason that will be sent to the applicant…"
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <p className="text-xs text-[#1A3226]/50">
            This reason will be sent to the applicant via email. Territories will be released back to available status.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handle} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Reject Claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}