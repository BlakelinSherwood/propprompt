import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function AdjustRevShareModal({ town, subscription, open, onClose, onSaved, pricing }) {
  const { toast } = useToast();
  const min = pricing?.sublicense_min_share_pct ?? 10;
  const max = pricing?.sublicense_max_share_pct ?? 40;
  const [pct, setPct] = useState(subscription?.sublicensor_revenue_share ?? pricing?.sublicense_default_share_pct ?? 20);
  const [loading, setLoading] = useState(false);

  const price = pricing?.[`${subscription?.tier}_monthly_price`] || 49;
  const yourCut = ((price * pct) / 100).toFixed(2);

  const save = async () => {
    setLoading(true);
    try {
      await base44.entities.TerritorySubscription.update(subscription.id, { sublicensor_revenue_share: pct });
      toast({ title: "Revenue share updated" });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  if (!town) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Rev Share — {town.city_town}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-3">
              <span className="text-sm text-[#1A3226]/60">Revenue Share %</span>
              <span className="text-lg font-bold text-purple-600">{pct}%</span>
            </div>
            <Slider
              min={min} max={max} step={1}
              value={[pct]}
              onValueChange={([v]) => setPct(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[#1A3226]/40 mt-1">
              <span>{min}%</span><span>{max}%</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm">
            <p className="text-purple-800">
              You receive <strong>${yourCut}/mo</strong> · Sublicensee pays <strong>${price}/mo</strong>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}