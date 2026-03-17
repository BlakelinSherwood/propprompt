import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

export default function ReleaseModal({ town, open, onClose, onConfirm, refusalDays }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onConfirm(town, reason);
    setLoading(false);
    setReason("");
    onClose();
  };

  if (!town) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Release {town.city_town}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              This will set the territory to <strong>available</strong> and grant you <strong>{refusalDays || 7} days</strong> right of first refusal on any incoming claim.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1A3226]">Reason (optional)</label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. No longer needed for expansion strategy"
              className="mt-1"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handle} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white">
              {loading ? "Releasing…" : "Confirm Release"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}