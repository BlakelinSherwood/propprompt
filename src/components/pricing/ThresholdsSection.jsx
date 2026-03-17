import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const REGULAR = [
  { key: 'auto_approve_hours', label: 'Auto-Approval Hours', suffix: 'hours', type: 'integer' },
  { key: 'rejection_recliam_days', label: 'Rejection Re-Claim Delay', suffix: 'days', type: 'days' },
  { key: 'founder_refusal_days', label: 'Founder Right of First Refusal', suffix: 'days', type: 'days' },
];

export default function ThresholdsSection({ pricing, onSave }) {
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);
  const [seatConfirm, setSeatConfirm] = useState('');
  const [seatEdit, setSeatEdit] = useState('');
  const [savingSeat, setSavingSeat] = useState(false);

  const getVal = (key) => editing[key] !== undefined ? editing[key] : (pricing[key] ?? '');
  const isDirty = (key) => editing[key] !== undefined && parseFloat(editing[key]) !== parseFloat(pricing[key]);

  const saveKey = async (key) => {
    const val = parseFloat(editing[key]);
    if (isNaN(val)) return;
    setSaving(key);
    await base44.functions.invoke('updatePricingConfig', { config_key: key, new_value: val });
    await onSave();
    setEditing(e => ({ ...e, [key]: undefined }));
    setSaving(null);
  };

  const saveSeatSize = async () => {
    const val = parseFloat(seatEdit);
    if (isNaN(val) || seatConfirm !== 'CONFIRM') return;
    setSavingSeat(true);
    await base44.functions.invoke('updatePricingConfig', { config_key: 'territory_seat_size', new_value: val });
    await onSave();
    setSeatEdit('');
    setSeatConfirm('');
    setSavingSeat(false);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Thresholds</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {REGULAR.map(f => (
          <div key={f.key} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-500 mb-2">{f.label}</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={getVal(f.key)}
                onChange={e => setEditing(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-24 h-9 text-xl font-bold border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                onBlur={() => isDirty(f.key) && saveKey(f.key)}
              />
              <span className="text-sm text-gray-400">{f.suffix}</span>
              {isDirty(f.key) && (
                <button onClick={() => saveKey(f.key)} disabled={saving === f.key}
                  className="text-xs bg-[#1A3226] text-white rounded px-2 py-1">
                  {saving === f.key ? '…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Seat Size — danger zone */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-semibold text-red-700">Territory Seat Size Formula</div>
            <p className="text-sm text-red-600 mt-1">
              Changing the seat size formula recalculates <strong>seats_total</strong> for every territory.
              This is <strong>irreversible</strong> without a data restore. Only change this if you are certain.
            </p>
            <p className="text-sm text-red-600 mt-1">Current: <strong>{pricing['territory_seat_size'] ?? '—'} residents/seat</strong></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">New seat size</label>
            <Input type="number" placeholder="50000" value={seatEdit}
              onChange={e => setSeatEdit(e.target.value)} className="w-36 h-9 bg-white" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type CONFIRM to enable save</label>
            <Input placeholder="CONFIRM" value={seatConfirm}
              onChange={e => setSeatConfirm(e.target.value)} className="w-40 h-9 bg-white font-mono" />
          </div>
          <Button
            onClick={saveSeatSize}
            disabled={savingSeat || seatConfirm !== 'CONFIRM' || !seatEdit}
            variant="destructive" className="h-9">
            {savingSeat ? 'Saving…' : 'Update Seat Formula'}
          </Button>
        </div>
      </div>
    </div>
  );
}