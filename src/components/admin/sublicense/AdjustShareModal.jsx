import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function AdjustShareModal({ open, onClose, subscription, territory, pricing, onSuccess }) {
  const { toast } = useToast();
  const [sharePct, setSharePct] = useState(subscription?.sublicensor_revenue_share || pricing?.sublicense_default_share_pct || 20);
  const [saving, setSaving] = useState(false);

  const minShare = pricing?.sublicense_min_share_pct || 10;
  const maxShare = pricing?.sublicense_max_share_pct || 40;
  const monthlyPrice = subscription?.monthly_price || 49;
  const shareAmount = ((monthlyPrice * sharePct) / 100).toFixed(2);

  async function handleSave() {
    setSaving(true);
    await base44.entities.TerritorySubscription.update(subscription.id, { sublicensor_revenue_share: sharePct });
    toast({ title: 'Revenue share updated' });
    setSaving(false);
    onSuccess();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Revenue Share — {territory?.city_town}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Your Revenue Share: <span className="font-bold text-[#1A3226]">{sharePct}%</span></Label>
            <input type="range" min={minShare} max={maxShare} step={1} value={sharePct}
              onChange={e => setSharePct(Number(e.target.value))}
              className="w-full mt-2 accent-[#1A3226]" />
            <div className="flex justify-between text-xs text-[#1A3226]/40 mt-0.5">
              <span>{minShare}%</span><span>{maxShare}%</span>
            </div>
            <div className="mt-2 p-3 bg-[#1A3226]/5 rounded-lg text-sm">
              <span className="text-[#B8982F] font-semibold">You receive ${shareAmount}/mo</span>
              <span className="text-[#1A3226]/50 mx-2">·</span>
              <span className="text-[#1A3226]/60">From ${monthlyPrice}/mo subscription</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}