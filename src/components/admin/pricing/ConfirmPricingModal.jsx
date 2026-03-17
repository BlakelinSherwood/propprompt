import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmPricingModal({ open, onClose, onConfirm, label, oldValue, newValue, valueType, requireConfirmText }) {
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const fmt = (v) => {
    if (valueType === "currency") return `$${Number(v).toFixed(2)}`;
    if (valueType === "percentage") return `${v}%`;
    if (valueType === "days") return `${v} days`;
    return String(v);
  };

  const canConfirm = !requireConfirmText || confirmText === "CONFIRM";

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    await onConfirm();
    setSaving(false);
    setConfirmText("");
    onClose();
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1A3226]">Confirm Pricing Change</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {requireConfirmText && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">This is a significant configuration change that affects core system behavior.</p>
            </div>
          )}
          <p className="text-sm text-[#1A3226]/70">
            Updating <strong>{label}</strong> from <strong>{fmt(oldValue)}</strong> to <strong>{fmt(newValue)}</strong>.
          </p>
          {valueType === "currency" && (
            <p className="text-xs text-[#1A3226]/50">
              This affects all future billing cycles for new subscribers. Existing subscribers are not affected until renewal.
            </p>
          )}
          {requireConfirmText && (
            <div>
              <p className="text-xs text-[#1A3226]/70 mb-1.5">Type <strong>CONFIRM</strong> to proceed:</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CONFIRM"
                className="text-sm"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!canConfirm || saving}
            onClick={handleConfirm}
            className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90"
          >
            {saving ? "Saving..." : "Confirm Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}