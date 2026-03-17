import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const TIERS = [
  { key: 'starter_monthly_price', label: 'Starter Territory', color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  { key: 'pro_monthly_price', label: 'Pro Territory', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  { key: 'team_monthly_price', label: 'Team Territory', color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700' },
];

export default function TierPricingSection({ pricing, onSave }) {
  const [editing, setEditing] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = (tier) => {
    const val = parseFloat(editing[tier.key]);
    if (isNaN(val) || val <= 0) return;
    setConfirm({ tier, newVal: val });
  };

  const confirmSave = async () => {
    setSaving(true);
    await base44.functions.invoke('updatePricingConfig', { config_key: confirm.tier.key, new_value: confirm.newVal });
    await onSave();
    setEditing(e => ({ ...e, [confirm.tier.key]: undefined }));
    setConfirm(null);
    setSaving(false);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Tier Pricing</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TIERS.map(tier => {
          const current = pricing[tier.key] ?? '—';
          const editVal = editing[tier.key] ?? '';
          const isDirty = editVal !== '' && parseFloat(editVal) !== parseFloat(current);
          return (
            <div key={tier.key} className={`rounded-xl border-2 p-5 ${tier.color}`}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.badge}`}>{tier.label}</span>
              <div className="mt-3 text-3xl font-bold text-[#1A3226]">
                ${parseFloat(current).toFixed(2)}
                <span className="text-sm font-normal text-[#1A3226]/50">/mo</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  type="number"
                  placeholder="New price"
                  value={editVal}
                  onChange={e => setEditing(v => ({ ...v, [tier.key]: e.target.value }))}
                  className="h-8 text-sm bg-white"
                />
                {isDirty && (
                  <Button size="sm" onClick={() => handleSave(tier)} className="bg-[#1A3226] text-white h-8 px-3">
                    Save
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Price Change</DialogTitle>
          </DialogHeader>
          {confirm && (
            <p className="text-sm text-gray-600">
              Updating <strong>{confirm.tier.label}</strong> price to{' '}
              <strong>${confirm.newVal.toFixed(2)}/mo</strong>.<br /><br />
              This affects all future billing cycles for <em>new</em> subscribers.
              Existing subscribers are not affected until renewal.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button onClick={confirmSave} disabled={saving} className="bg-[#1A3226] text-white">
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}