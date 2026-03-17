import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const TIERS = ['starter', 'pro', 'team'];

export default function SublicenseModal({ open, onClose, territory, pricing, onSuccess }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('starter');
  const [sharePct, setSharePct] = useState(pricing?.sublicense_default_share_pct || 20);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const minShare = pricing?.sublicense_min_share_pct || 10;
  const maxShare = pricing?.sublicense_max_share_pct || 40;
  const tierPrices = {
    starter: pricing?.starter_monthly_price || 49,
    pro: pricing?.pro_monthly_price || 79,
    team: pricing?.team_monthly_price || 129,
  };

  const fullPrice = tierPrices[tier];
  const shareAmount = ((fullPrice * sharePct) / 100).toFixed(2);

  async function handleSubmit() {
    if (!email || !tier) return;
    setSaving(true);
    const res = await base44.functions.invoke('createSublicense', {
      territory_id: territory.id,
      sublicensee_email: email,
      tier,
      revenue_share_pct: sharePct,
      note,
    });
    setSaving(false);
    if (res.data?.success) {
      toast({ title: 'Sublicense created', description: `${territory.city_town} sublicensed to ${email}.` });
      onSuccess();
      onClose();
    } else {
      toast({ title: 'Error', description: res.data?.error || 'Failed to create sublicense', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sublicense — {territory?.city_town}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Sublicensee Email *</Label>
            <Input className="mt-1" value={email} onChange={e => setEmail(e.target.value)} placeholder="agent@brokerage.com" />
          </div>
          <div>
            <Label>Subscription Tier *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {TIERS.map(t => (
                <button key={t} onClick={() => setTier(t)}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${tier === t ? 'border-[#1A3226] bg-[#1A3226] text-white' : 'border-[#1A3226]/20 text-[#1A3226]/70 hover:border-[#1A3226]/50'}`}>
                  <div className="capitalize">{t}</div>
                  <div className={`text-xs mt-0.5 ${tier === t ? 'text-white/70' : 'text-[#1A3226]/40'}`}>${tierPrices[t]}/mo</div>
                </button>
              ))}
            </div>
          </div>
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
              <span className="text-[#1A3226]/60">Sublicensee pays ${fullPrice}/mo</span>
            </div>
          </div>
          <div>
            <Label>Internal Note (optional)</Label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-transparent resize-none h-16" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !email}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? 'Creating…' : 'Create Sublicense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}